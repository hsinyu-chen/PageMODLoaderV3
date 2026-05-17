import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ModSyncService } from '../mod-sync.service';

@Component({
  selector: 'app-folder-controls',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './folder-controls.component.html',
  styleUrl: './folder-controls.component.scss',
})
export class FolderControlsComponent implements OnInit {
  private sync = inject(ModSyncService);
  readonly currentHandle = this.sync.currentHandle;
  readonly userScriptsAvailable = signal<boolean>(FolderControlsComponent.checkUserScriptsAvailable());

  ngOnInit(): void {
    this.sync.restoreHandle();
  }

  private static checkUserScriptsAvailable(): boolean {
    try {
      return !!chrome.userScripts;
    } catch {
      return false;
    }
  }

  selectDir() {
    return this.sync.selectDir();
  }

  resync() {
    return this.sync.resync(this.currentHandle());
  }
}
