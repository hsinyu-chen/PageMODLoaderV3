import { Component, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Mod, ModDb } from '@lib/types';
import { ModOptionsService } from '../mod-options.service';
import { ModOptionsComponent } from '../mod-options/mod-options.component';

// Echoed through storage so this view ignores the mod-enable write it just made.
const MODS_WRITE_ID = 'modsWriteId';

@Component({
  selector: 'app-mod-list',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatTableModule,
    MatSlideToggleModule,
    FormsModule,
    ModOptionsComponent,
  ],
  templateUrl: './mod-list.component.html',
  styleUrl: './mod-list.component.scss',
})
export class ModListComponent implements OnInit, OnDestroy {
  // 'popup' has a real active page; 'options' (full page) has no target tab, so per-tab
  // controls (button/label/dynamic) are hidden there.
  readonly surface = input<'popup' | 'options'>('popup');
  readonly mods = signal<Mod[]>([]);
  readonly optionsSvc = inject(ModOptionsService);
  private snackBar = inject(MatSnackBar);
  private updateSyncContext = Promise.resolve();
  private pendingWriteIds = new Set<string>();

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
    if (areaName !== 'local' || !changes['mods']) return;
    const incomingWriteId = changes[MODS_WRITE_ID]?.newValue;
    if (typeof incomingWriteId === 'string' && this.pendingWriteIds.delete(incomingWriteId)) return;
    this.applyModDb(changes['mods'].newValue as ModDb | undefined);
  };

  async loadMods() {
    const values = await chrome.storage.local.get('mods');
    this.applyModDb(values['mods'] as ModDb | undefined);
  }

  private applyModDb(db: ModDb | undefined) {
    this.mods.set(db ? Object.values(db) : []);
  }

  getDisplayMatch(match: string | string[]) {
    return typeof match === 'string' ? match : match.join(',');
  }

  updateState() {
    const last = this.updateSyncContext;
    this.updateSyncContext = (async () => {
      try {
        await last;
      } catch (e) {
        console.error('Previous mod update failed', e);
      }
      const update: ModDb = {};
      for (const mod of this.mods()) {
        update[mod.name] = mod;
      }
      const writeId = crypto.randomUUID();
      this.pendingWriteIds.add(writeId);
      try {
        await chrome.storage.local.set({ mods: update, [MODS_WRITE_ID]: writeId });
        await chrome.runtime.sendMessage('update');
      } catch (e) {
        this.pendingWriteIds.delete(writeId);
        console.error('Failed to persist mod state', e);
        this.snackBar.open(`Failed to save mod state: ${e}`, 'OK', { duration: 4000 });
        await this.loadMods();
      }
    })();
  }
}
