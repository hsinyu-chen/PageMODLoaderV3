import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { getFileHandleDeep, readFile } from '../../../helpers';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { Mod, ModDb, ModelConfig } from '../../../../lib/types';

@Component({
  selector: 'app-option-index',
  standalone: true,
  imports: [
    MatButtonModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatTableModule,
    MatSlideToggleModule,
    MatDividerModule,
    FormsModule],
  templateUrl: './option-index.component.html',
  styleUrl: './option-index.component.scss'
})
export class OptionIndexComponent implements OnInit {
  ngOnInit(): void {
    (async () => {
      await this.loadMods();
    })();

  }
  readonly mods = signal<Mod[]>([]);
  updateSyncContext = Promise.resolve();
  getDisplayMatch(match: string | string[]) {
    return typeof match === 'string' ? match : match.join(',');
  }
  updateState(mod: Mod) {
    const last = this.updateSyncContext;
    this.updateSyncContext = (async () => {
      await last;
      const update: ModDb = {}
      for (const mod of this.mods()) {
        update[mod.name] = mod
      }
      await chrome.storage.local.set({ mods: update });
      await this.callUpdateRegist();
    })();
  }
  async loadMods() {
    const values = await chrome.storage.local.get('mods')
    if (values['mods']) {
      const mods: Mod[] = []
      for (const [, mod] of Object.entries(values['mods'] as ModDb)) {
        mods.push(mod)
      }
      this.mods.set(mods)
    } else {
      this.mods.set([])
    }
  }
  private snakeBar = inject(MatSnackBar);
  public currentHandle = signal<FileSystemDirectoryHandle | undefined>(undefined);
  async resync(dirHandle: FileSystemDirectoryHandle | undefined) {
    const values = await chrome.storage.local.get('mods')
    const current = values['mods'] ?? {};
    if (dirHandle && (await dirHandle.requestPermission({ mode: 'read' })) == 'granted') {
      this.currentHandle.set(dirHandle);
      const mods: ModDb = {}
      for await (const entry of dirHandle.values()) {
        if (entry.kind === "directory") {
          try {
            let config: FileSystemFileHandle;
            try {
              config = await entry.getFileHandle('config.json', { create: false })
            } catch {
              continue;
            }
            const file = await config.getFile();
            const text = await readFile(file);
            const obj = JSON.parse(text) as ModelConfig;
            const enabled = current[entry.name]?.enabled === false ? false : true;
            const mod: Mod = { match: obj.match, name: entry.name, files: [], enabled: enabled };

            for (const inject of obj.inject) {
              try {
                const file = await getFileHandleDeep(entry, inject.path);
                if (file.kind === 'file') {
                  const content = await readFile(await file.getFile());
                  mod.files.push({
                    path: inject.path,
                    content: content,
                    type: inject.type,
                    file: file.name
                  })
                }
              } catch (e) {
                throw `error access file ${inject.path} ${e}`
              }
            }
            if (mod.files.length && mod.match) {
              mods[entry.name] = mod;
            }

          } catch (e) {
            this.snakeBar.open(`error loading MOD ${entry.name} ${e}`);
          }
        }
      }
      await chrome.storage.local.set({ mods: mods });
      await this.loadMods();
      await this.callUpdateRegist();
    }
  }
  async selectDir() {
    await this.resync(await window.showDirectoryPicker({ mode: 'read' }))
  }

  private async callUpdateRegist() {
    await chrome.runtime.sendMessage('update');
  }
}
