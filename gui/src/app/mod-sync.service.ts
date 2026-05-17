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
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await window.showDirectoryPicker({ mode: 'read' });
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.error('Failed to open directory picker', e);
      return;
    }
    await this.resync(handle);
  }

  async resync(dirHandle: FileSystemDirectoryHandle | undefined): Promise<void> {
    if (!dirHandle) return;
    const values = await chrome.storage.local.get('mods');
    const current = (values['mods'] ?? {}) as ModDb;
    if ((await dirHandle.requestPermission({ mode: 'read' })) !== 'granted') {
      this.snackBar.open('Permission to read the mod folder was denied.', 'OK', { duration: 4000 });
      return;
    }

    this.currentHandle.set(dirHandle);
    await saveDirHandle(dirHandle);
    const mods: ModDb = {};
    for await (const entry of dirHandle.values()) {
      if (entry.kind !== 'directory') continue;
      try {
        let config: FileSystemFileHandle;
        try {
          config = await entry.getFileHandle('config.json', { create: false });
        } catch (e) {
          if (e instanceof DOMException && e.name === 'NotFoundError') {
            continue;
          }
          console.warn(`Error accessing config.json in ${entry.name}:`, e);
          continue;
        }
        const file = await config.getFile();
        const text = await readFile(file);
        const obj = JSON.parse(text) as ModelConfig;
        if (!obj || !obj.match || !Array.isArray(obj.inject)) {
          throw new Error('invalid config.json: missing or invalid "match" or "inject"');
        }
        const enabled = current[entry.name]?.enabled !== false;
        const mod: Mod = { match: obj.match, name: entry.name, files: [], enabled };

        for (const injection of obj.inject) {
          try {
            const fileHandle = await getFileHandleDeep(entry, injection.path);
            if (fileHandle.kind === 'file') {
              const content = await readFile(await fileHandle.getFile());
              mod.files.push({
                path: injection.path,
                content,
                type: injection.type,
                file: fileHandle.name,
              });
            }
          } catch (e) {
            throw new Error(`error access file ${injection.path}: ${e}`);
          }
        }
        if (mod.files.length) {
          mods[entry.name] = mod;
        }
      } catch (e) {
        this.snackBar.open(`error loading MOD ${entry.name}: ${e}`, 'OK', { duration: 4000 });
      }
    }
    const latest = ((await chrome.storage.local.get('mods'))['mods'] ?? {}) as ModDb;
    for (const name of Object.keys(mods)) {
      const live = latest[name];
      if (live) mods[name].enabled = live.enabled;
    }
    await chrome.storage.local.set({ mods });
    await chrome.runtime.sendMessage('update');
  }
}
