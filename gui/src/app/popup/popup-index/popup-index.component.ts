import { Component, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { RouterModule, RouterOutlet } from '@angular/router';
import { ModExcutingResult, ModExcutionResultDb } from '@lib/types';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

type ScriptMatch = {
  pattern: string;
  isMatch: boolean;
};

type ScriptData = {
  name: string;
  isMatch: boolean;
  matches: ScriptMatch[];
};

@Component({
  selector: 'app-popup-index',
  standalone: true,
  imports: [RouterOutlet, RouterModule, MatButtonModule, MatTableModule, MatIconModule, MatTooltipModule],
  templateUrl: './popup-index.component.html',
  styleUrl: './popup-index.component.scss'
})
export class PopupIndexComponent implements OnInit {
  current = signal<ModExcutingResult[]>([]);
  ngOnInit(): void {
    (async () => {
      const currentTab = await chrome.tabs.query({ currentWindow: true, active: true });
      if (currentTab[0]) {
        const results = await chrome.runtime.sendMessage({ query: currentTab[0].id }) as ModExcutionResultDb
        if (results) {
          console.log(results)
          this.current.set(Object.values(results))
        } else {
          this.current.set([])
        }
      }

    })()
  }
  async openOption(e: Event) {
    chrome.tabs.create({ 'url': `chrome-extension://${chrome.runtime.id}/gui/index.html#option` });
  }

}
