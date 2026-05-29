import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Mod, ModDb, ModelConfig, ModOption, ModOptionType } from '@lib/types';
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
    try {
      await this.resyncInner(dirHandle);
    } catch (e) {
      console.error('Re-sync failed', e);
      this.snackBar.open(`Re-sync failed: ${e}`, 'OK', { duration: 5000 });
    }
  }

  private async resyncInner(dirHandle: FileSystemDirectoryHandle): Promise<void> {
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
        const options = parseOptions(obj.options);
        if (obj.encrypt !== undefined && typeof obj.encrypt !== 'boolean') {
          throw new Error('"encrypt" must be a boolean');
        }
        const mod: Mod = {
          match: obj.match, name: entry.name, files: [], enabled,
          ...(options ? { options } : {}), ...(obj.encrypt ? { encrypt: true } : {}),
        };

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
    // modOptions is intentionally left untouched: a removed/renamed mod keeps its saved values
    // so re-adding the folder restores them. Orphaned keys are accepted over data loss.
    await chrome.storage.local.set({ mods });
    await chrome.runtime.sendMessage('update');
  }
}

const OPTION_TYPES: ModOptionType[] = ['toggle', 'text', 'dropdown', 'checklist', 'button', 'label'];

function parseOptions(raw: unknown): ModOption[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) throw new Error('"options" must be an array');
  const seen = new Set<string>();
  return raw.map((o, i) => {
    const where = `options[${i}]`;
    if (!o || typeof o !== 'object') throw new Error(`${where} must be an object`);
    const { key, type, label, choices, dynamic } = o as Record<string, unknown>;
    if (typeof key !== 'string' || !key) throw new Error(`${where}.key must be a non-empty string`);
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error(`${where}.key must not be a reserved word`);
    if (seen.has(key)) throw new Error(`duplicate option key "${key}"`);
    seen.add(key);
    if (typeof type !== 'string' || !OPTION_TYPES.includes(type as ModOptionType)) {
      throw new Error(`${where}.type must be one of ${OPTION_TYPES.join('/')}`);
    }
    if (typeof label !== 'string' || !label) throw new Error(`${where}.label must be a non-empty string`);

    const option: ModOption = { key, type: type as ModOptionType, label };

    if (type === 'dropdown' || type === 'checklist') {
      if (choices !== undefined) option.choices = parseChoices(choices, where);
      if (dynamic === true) option.dynamic = true;
      if (!dynamic && !option.choices?.length) {
        throw new Error(`${where} (${type}) needs non-empty "choices" unless "dynamic" is true`);
      }
    }

    if (type !== 'button') {
      const def = (o as Record<string, unknown>)['default'];
      if (def !== undefined) {
        validateDefault(type as ModOptionType, def, where);
        option.default = def as ModOption['default'];
        if (!dynamic && (type === 'dropdown' || type === 'checklist')) {
          const choiceValues = new Set((option.choices ?? []).map(c => c.value));
          const picked = type === 'checklist' ? (def as string[]) : [def as string];
          for (const val of picked) {
            if (!choiceValues.has(val)) throw new Error(`${where}.default "${val}" is not one of the choices`);
          }
        }
      }
    }
    return option;
  });
}

function parseChoices(raw: unknown, where: string): { value: string; label: string }[] {
  if (!Array.isArray(raw)) throw new Error(`${where}.choices must be an array`);
  return raw.map((c, i) => {
    if (!c || typeof c !== 'object') throw new Error(`${where}.choices[${i}] must be an object`);
    const { value, label } = c as Record<string, unknown>;
    if (typeof value !== 'string') throw new Error(`${where}.choices[${i}].value must be a string`);
    if (typeof label !== 'string') throw new Error(`${where}.choices[${i}].label must be a string`);
    return { value, label };
  });
}

function validateDefault(type: ModOptionType, def: unknown, where: string): void {
  const ok =
    type === 'toggle' ? typeof def === 'boolean' :
    type === 'checklist' ? Array.isArray(def) && def.every(v => typeof v === 'string') :
    typeof def === 'string'; // text, dropdown
  if (!ok) throw new Error(`${where}.default has the wrong type for ${type}`);
}
