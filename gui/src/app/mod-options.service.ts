import { inject, Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  Mod, ModOption, ModOptionChoice, ModOptionValue, ModOptionsDb, ModDynamicChoices, ModDynamicLabels, ModDisplayState,
  STORAGE_MOD_OPTIONS, STORAGE_MOD_OPTIONS_REV, MSG_PML_GET_DISPLAY, MSG_PML_LABEL_UPDATE, MSG_PML_BUTTON, resolveOptionValue, ownValue,
} from '@lib/types';

// Echoed through storage so a view ignores the option write it just made (no self-feedback,
// no clobbering a focused input).
const MOD_OPTIONS_WRITE_ID = 'modOptionsWriteId';

// Shared option state for every surface that renders option controls (the popup's Options tab,
// its Current Page tab, and the full options page). A singleton so all of them reflect the same
// live values, dynamic choices and labels.
@Injectable({ providedIn: 'root' })
export class ModOptionsService {
  readonly modOptions = signal<ModOptionsDb>({});
  readonly dynamicChoices = signal<ModDynamicChoices>({});
  readonly dynamicLabels = signal<ModDynamicLabels>({});
  private activeTabId: number | undefined;
  private snackBar = inject(MatSnackBar);
  private optionsSyncContext = Promise.resolve();
  private pendingWriteIds = new Set<string>();

  constructor() {
    void this.loadOptions();
    void this.loadDisplay();
    chrome.runtime.onMessage.addListener(this.onLabelUpdate);
    chrome.storage.onChanged.addListener(this.onStorageChanged);
  }

  private onLabelUpdate = (request: any) => {
    if (request?.type !== MSG_PML_LABEL_UPDATE || request.tabId !== this.activeTabId) return;
    const db = { ...this.dynamicLabels() };
    db[request.mod] = { ...(db[request.mod] ?? {}), [request.key]: request.text };
    this.dynamicLabels.set(db);
  };

  private onStorageChanged = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: chrome.storage.AreaName
  ) => {
    if (areaName !== 'local' || !changes[STORAGE_MOD_OPTIONS]) return;
    const incoming = changes[MOD_OPTIONS_WRITE_ID]?.newValue;
    if (typeof incoming === 'string' && this.pendingWriteIds.delete(incoming)) return;
    this.modOptions.set((changes[STORAGE_MOD_OPTIONS].newValue ?? {}) as ModOptionsDb);
  };

  private async loadOptions() {
    const values = await chrome.storage.local.get(STORAGE_MOD_OPTIONS);
    this.modOptions.set((values[STORAGE_MOD_OPTIONS] ?? {}) as ModOptionsDb);
  }

  private async loadDisplay() {
    const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
    this.activeTabId = tabs[0]?.id;
    if (this.activeTabId === undefined) return;
    try {
      const display = await chrome.runtime.sendMessage({ type: MSG_PML_GET_DISPLAY, tabId: this.activeTabId }) as ModDisplayState | undefined;
      this.dynamicChoices.set(display?.choices ?? {});
      this.dynamicLabels.set(display?.labels ?? {});
    } catch (e) {
      console.warn('Failed to load display state from service worker', e);
    }
  }

  // Per-tab controls (button/label/dynamic) only make sense in the popup, where there is an
  // active target page. The full options page shows only global value options.
  visibleOptions(mod: Mod, surface: 'popup' | 'options'): ModOption[] {
    const options = mod.options ?? [];
    if (surface === 'popup') return options;
    return options.filter(o => o.type !== 'button' && o.type !== 'label' && !o.dynamic);
  }

  // Choices: dynamic (this tab's, from a running mod) take precedence, else the static schema.
  getChoices(mod: Mod, option: ModOption): ModOptionChoice[] {
    return this.dynamicChoices()[mod.name]?.[option.key] ?? option.choices ?? [];
  }
  isUnavailable(mod: Mod, option: ModOption): boolean {
    return !!option.dynamic && this.getChoices(mod, option).length === 0;
  }
  getLabel(mod: Mod, option: ModOption): string {
    return this.dynamicLabels()[mod.name]?.[option.key] ?? (option.default as string | undefined) ?? '';
  }

  private value(mod: Mod, option: ModOption): ModOptionValue {
    return resolveOptionValue(option, ownValue(this.modOptions()[mod.name] ?? {}, option.key));
  }
  boolValue(mod: Mod, option: ModOption): boolean { return this.value(mod, option) as boolean; }
  textValue(mod: Mod, option: ModOption): string { return this.value(mod, option) as string; }
  listValue(mod: Mod, option: ModOption): string[] { return this.value(mod, option) as string[]; }

  setValue(mod: Mod, option: ModOption, value: ModOptionValue): void {
    const db = { ...this.modOptions() };
    db[mod.name] = { ...(db[mod.name] ?? {}), [option.key]: value };
    this.modOptions.set(db);
    this.write();
  }

  pressButton(mod: Mod, key: string): void {
    if (this.activeTabId === undefined) {
      this.snackBar.open('Open the target page first to use this button.', 'OK', { duration: 3000 });
      return;
    }
    void chrome.runtime.sendMessage({ type: MSG_PML_BUTTON, tabId: this.activeTabId, mod: mod.name, key });
  }

  private write(): void {
    const last = this.optionsSyncContext;
    this.optionsSyncContext = (async () => {
      try { await last; } catch { /* previous write reported its own error */ }
      const v = await chrome.storage.local.get(STORAGE_MOD_OPTIONS_REV);
      const rev = ((v[STORAGE_MOD_OPTIONS_REV] ?? 0) as number) + 1;
      const writeId = crypto.randomUUID();
      this.pendingWriteIds.add(writeId);
      try {
        await chrome.storage.local.set({
          [STORAGE_MOD_OPTIONS]: this.modOptions(),
          [STORAGE_MOD_OPTIONS_REV]: rev,
          [MOD_OPTIONS_WRITE_ID]: writeId,
        });
      } catch (e) {
        this.pendingWriteIds.delete(writeId);
        this.snackBar.open(`Failed to save options: ${e}`, 'OK', { duration: 4000 });
      }
    })();
  }
}
