import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import {
  Mod, ModDb, ModOption, ModOptionChoice, ModOptionValue, ModOptionsDb, ModDynamicChoices,
  STORAGE_MOD_OPTIONS, STORAGE_MOD_OPTIONS_REV, MSG_PML_GET_CHOICES, MSG_PML_BUTTON, resolveOptionValue,
} from '@lib/types';

@Component({
  selector: 'app-mod-list',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatTableModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
  ],
  templateUrl: './mod-list.component.html',
  styleUrl: './mod-list.component.scss',
})
export class ModListComponent implements OnInit, OnDestroy {
  readonly mods = signal<Mod[]>([]);
  readonly modOptions = signal<ModOptionsDb>({});
  readonly dynamicChoices = signal<ModDynamicChoices>({});
  private activeTabId: number | undefined;
  private snackBar = inject(MatSnackBar);
  private updateSyncContext = Promise.resolve();
  private optionsSyncContext = Promise.resolve();
  private pendingWriteIds = new Set<string>();

  ngOnInit(): void {
    this.loadMods();
    void this.loadOptions();
    void this.loadDynamicChoices();
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
    const incomingWriteId = changes['modsWriteId']?.newValue;
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

  async loadOptions() {
    const values = await chrome.storage.local.get(STORAGE_MOD_OPTIONS);
    this.modOptions.set((values[STORAGE_MOD_OPTIONS] ?? {}) as ModOptionsDb);
  }

  async loadDynamicChoices() {
    const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
    this.activeTabId = tabs[0]?.id;
    if (this.activeTabId === undefined) return;
    const choices = await chrome.runtime.sendMessage({ type: MSG_PML_GET_CHOICES, tabId: this.activeTabId });
    this.dynamicChoices.set((choices ?? {}) as ModDynamicChoices);
  }

  getDisplayMatch(match: string | string[]) {
    return typeof match === 'string' ? match : match.join(',');
  }

  // Choices: dynamic (this tab's, from a running mod) take precedence, else the static schema.
  getChoices(mod: Mod, option: ModOption): ModOptionChoice[] {
    return this.dynamicChoices()[mod.name]?.[option.key] ?? option.choices ?? [];
  }
  // A dynamic control with no static fallback and no live choices is unusable until its page loads.
  isUnavailable(mod: Mod, option: ModOption): boolean {
    return !!option.dynamic && this.getChoices(mod, option).length === 0;
  }

  private value(mod: Mod, option: ModOption): ModOptionValue {
    return resolveOptionValue(option, this.modOptions()[mod.name]?.[option.key]);
  }
  boolValue(mod: Mod, option: ModOption): boolean { return this.value(mod, option) as boolean; }
  textValue(mod: Mod, option: ModOption): string { return this.value(mod, option) as string; }
  listValue(mod: Mod, option: ModOption): string[] { return this.value(mod, option) as string[]; }

  setValue(mod: Mod, option: ModOption, value: ModOptionValue): void {
    const db = { ...this.modOptions() };
    db[mod.name] = { ...(db[mod.name] ?? {}), [option.key]: value };
    this.modOptions.set(db);
    this.writeOptions();
  }

  pressButton(mod: Mod, key: string): void {
    if (this.activeTabId === undefined) {
      this.snackBar.open('Open the target page first to use this button.', 'OK', { duration: 3000 });
      return;
    }
    void chrome.runtime.sendMessage({ type: MSG_PML_BUTTON, tabId: this.activeTabId, mod: mod.name, key });
  }

  private writeOptions(): void {
    const last = this.optionsSyncContext;
    this.optionsSyncContext = (async () => {
      try { await last; } catch { /* previous write reported its own error */ }
      const v = await chrome.storage.local.get(STORAGE_MOD_OPTIONS_REV);
      const rev = ((v[STORAGE_MOD_OPTIONS_REV] ?? 0) as number) + 1;
      try {
        await chrome.storage.local.set({ [STORAGE_MOD_OPTIONS]: this.modOptions(), [STORAGE_MOD_OPTIONS_REV]: rev });
      } catch (e) {
        this.snackBar.open(`Failed to save options: ${e}`, 'OK', { duration: 4000 });
      }
    })();
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
        await chrome.storage.local.set({ mods: update, modsWriteId: writeId });
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
