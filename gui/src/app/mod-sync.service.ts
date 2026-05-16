import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Mod, ModDb, ModelConfig } from '@lib/types';
import { getFileHandleDeep, readFile } from '../helpers';
import { loadDirHandle, saveDirHandle } from '../dir-handle-db';

@Injectable({ providedIn: 'root' })
export class ModSyncService {
  private snackBar = inject(MatSnackBar);
  readonly currentHandle = signal<FileSystemDirectoryHandle | undefined>(undefined);

  async restoreHandle(): Promise<FileSystemDirectoryHandle | undefined> {
    try {
      const handle = await loadDirHandle();
      if (handle) {
        this.currentHandle.set(handle);
      }
      return handle;
    } catch (e) {
      console.warn('Failed to restore directory handle from IndexedDB', e);
      return undefined;
    }
  }

  async selectDir(): Promise<void> {
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    await this.resync(handle);
  }

  async resync(dirHandle: FileSystemDirectoryHandle | undefined): Promise<void> {
    if (!dirHandle) return;
    const values = await chrome.storage.local.get('mods');
    const current = (values['mods'] ?? {}) as ModDb;
    if ((await dirHandle.requestPermission({ mode: 'read' })) !== 'granted') return;

    this.currentHandle.set(dirHandle);
    await saveDirHandle(dirHandle);
    const mods: ModDb = {};
    for await (const entry of dirHandle.values()) {
      if (entry.kind !== 'directory') continue;
      try {
        let config: FileSystemFileHandle;
        try {
          config = await entry.getFileHandle('config.json', { create: false });
        } catch {
          continue;
        }
        const file = await config.getFile();
        const text = await readFile(file);
        const obj = JSON.parse(text) as ModelConfig;
        const enabled = current[entry.name]?.enabled === false ? false : true;
        const mod: Mod = { match: obj.match, name: entry.name, files: [], enabled };

        for (const inject of obj.inject) {
          try {
            const fileHandle = await getFileHandleDeep(entry, inject.path);
            if (fileHandle.kind === 'file') {
              const content = await readFile(await fileHandle.getFile());
              mod.files.push({
                path: inject.path,
                content,
                type: inject.type,
                file: fileHandle.name,
              });
            }
          } catch (e) {
            throw `error access file ${inject.path} ${e}`;
          }
        }
        if (mod.files.length && mod.match) {
          mods[entry.name] = mod;
        }
      } catch (e) {
        this.snackBar.open(`error loading MOD ${entry.name} ${e}`);
      }
    }
    await chrome.storage.local.set({ mods });
    await chrome.runtime.sendMessage('update');
  }
}
