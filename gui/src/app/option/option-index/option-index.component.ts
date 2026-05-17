import { Component } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { FolderControlsComponent } from '../../folder-controls/folder-controls.component';
import { ModListComponent } from '../../mod-list/mod-list.component';

@Component({
  selector: 'app-option-index',
  standalone: true,
  imports: [
    MatDividerModule,
    FolderControlsComponent,
    ModListComponent,
  ],
  templateUrl: './option-index.component.html',
  styleUrl: './option-index.component.scss'
})
export class OptionIndexComponent {}
