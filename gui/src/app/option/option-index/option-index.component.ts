import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { ModSyncService } from '../../mod-sync.service';
import { ModListComponent } from '../../mod-list/mod-list.component';

@Component({
  selector: 'app-option-index',
  standalone: true,
  imports: [
    MatButtonModule,
    MatSnackBarModule,
    MatDividerModule,
    ModListComponent,
  ],
  templateUrl: './option-index.component.html',
  styleUrl: './option-index.component.scss'
})
export class OptionIndexComponent implements OnInit {
  private sync = inject(ModSyncService);
  readonly userScriptsAvailable = signal<boolean>(true);
  readonly currentHandle = this.sync.currentHandle;

  ngOnInit(): void {
    this.userScriptsAvailable.set(this.checkUserScriptsAvailable());
    this.sync.restoreHandle();
  }

  private checkUserScriptsAvailable(): boolean {
    try {
      return !!chrome.userScripts;
    } catch {
      return false;
    }
  }

  async resync(dirHandle: FileSystemDirectoryHandle | undefined) {
    await this.sync.resync(dirHandle);
  }
  async selectDir() {
    await this.sync.selectDir();
  }
}
