import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';
import { Mod, ModDb } from '@lib/types';

@Component({
  selector: 'app-mod-list',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatTableModule,
    MatSlideToggleModule,
    FormsModule,
  ],
  templateUrl: './mod-list.component.html',
  styleUrl: './mod-list.component.scss',
})
export class ModListComponent implements OnInit, OnDestroy {
  readonly mods = signal<Mod[]>([]);
  private updateSyncContext = Promise.resolve();

  ngOnInit(): void {
    this.loadMods();
    chrome.storage.onChanged.addListener(this.onStorageChanged);
  }

  ngOnDestroy(): void {
    chrome.storage.onChanged.removeListener(this.onStorageChanged);
  }

  private onStorageChanged = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: chrome.storage.AreaName
  ) => {
    if (areaName === 'local' && changes['mods']) {
      this.applyModDb(changes['mods'].newValue as ModDb | undefined);
    }
  };

  async loadMods() {
    const values = await chrome.storage.local.get('mods');
    this.applyModDb(values['mods'] as ModDb | undefined);
  }

  private applyModDb(db: ModDb | undefined) {
    if (db) {
      this.mods.set(Object.values(db));
    } else {
      this.mods.set([]);
    }
  }

  getDisplayMatch(match: string | string[]) {
    return typeof match === 'string' ? match : match.join(',');
  }

  updateState(_mod: Mod) {
    const last = this.updateSyncContext;
    this.updateSyncContext = (async () => {
      await last;
      const update: ModDb = {};
      for (const mod of this.mods()) {
        update[mod.name] = mod;
      }
      await chrome.storage.local.set({ mods: update });
      await chrome.runtime.sendMessage('update');
    })();
  }
}
