import { Component, OnInit, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { ModExcutingResult, ModExcutionResultDb } from '@lib/types';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { FolderControlsComponent } from '../../folder-controls/folder-controls.component';
import { ModListComponent } from '../../mod-list/mod-list.component';

@Component({
  selector: 'app-popup-index',
  standalone: true,
  imports: [
    MatTableModule,
    MatTabsModule,
    MatIconModule,
    MatTooltipModule,
    MatButtonModule,
    FolderControlsComponent,
    ModListComponent,
  ],
  templateUrl: './popup-index.component.html',
  styleUrl: './popup-index.component.scss'
})
export class PopupIndexComponent implements OnInit {
  current = signal<ModExcutingResult[]>([]);

  openOptions(): void {
    chrome.tabs.create({ url: chrome.runtime.getURL('gui/index.html#/option') });
  }

  ngOnInit(): void {
    (async () => {
      const currentTab = await chrome.tabs.query({ currentWindow: true, active: true });
      if (currentTab[0]) {
        const results = await chrome.runtime.sendMessage({ query: currentTab[0].id }) as ModExcutionResultDb
        if (results) {
          this.current.set(Object.values(results))
        } else {
          this.current.set([])
        }
      }
    })()
  }
}
