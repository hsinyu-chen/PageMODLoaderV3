import { Component, OnInit, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { Mod, ModDb, ModExcutingResult, ModExcutionResultDb } from '@lib/types';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { FolderControlsComponent } from '../../folder-controls/folder-controls.component';
import { ModListComponent } from '../../mod-list/mod-list.component';
import { ModOptionsComponent } from '../../mod-options/mod-options.component';

@Component({
  selector: 'app-popup-index',
  standalone: true,
  imports: [
    MatTabsModule,
    MatIconModule,
    MatTooltipModule,
    MatButtonModule,
    FolderControlsComponent,
    ModListComponent,
    ModOptionsComponent,
  ],
  templateUrl: './popup-index.component.html',
  styleUrl: './popup-index.component.scss'
})
export class PopupIndexComponent implements OnInit {
  current = signal<ModExcutingResult[]>([]);
  mods = signal<ModDb>({});

  openOptions(): void {
    chrome.tabs.create({ url: chrome.runtime.getURL('gui/index.html#/option') });
  }

  modFor(name: string): Mod | undefined {
    return this.mods()[name];
  }

  ngOnInit(): void {
    (async () => {
      const values = await chrome.storage.local.get('mods');
      this.mods.set((values['mods'] ?? {}) as ModDb);
      const currentTab = await chrome.tabs.query({ currentWindow: true, active: true });
      if (currentTab[0]) {
        const results = await chrome.runtime.sendMessage({ query: currentTab[0].id }) as ModExcutionResultDb
        this.current.set(results ? Object.values(results) : []);
      }
    })()
  }
}
