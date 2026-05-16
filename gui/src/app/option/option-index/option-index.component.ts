import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { Mod, ModDb } from '@lib/types';
import { ModSyncService } from '../../mod-sync.service';

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
  private sync = inject(ModSyncService);
  readonly mods = signal<Mod[]>([]);
  readonly userScriptsAvailable = signal<boolean>(true);
  readonly currentHandle = this.sync.currentHandle;
  updateSyncContext = Promise.resolve();

  ngOnInit(): void {
    this.userScriptsAvailable.set(this.checkUserScriptsAvailable());
    (async () => {
      await this.loadMods();
      await this.sync.restoreHandle();
    })();
  }

  private checkUserScriptsAvailable(): boolean {
    try {
      return !!chrome.userScripts;
    } catch {
      return false;
    }
  }
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
      await chrome.runtime.sendMessage('update');
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
  async resync(dirHandle: FileSystemDirectoryHandle | undefined) {
    await this.sync.resync(dirHandle);
    await this.loadMods();
  }
  async selectDir() {
    await this.sync.selectDir();
    await this.loadMods();
  }
}
