import { Component, inject, input } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { Mod } from '@lib/types';
import { ModOptionsService } from '../mod-options.service';

@Component({
  selector: 'app-mod-options',
  standalone: true,
  imports: [
    MatSlideToggleModule,
    MatSelectModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
  ],
  templateUrl: './mod-options.component.html',
  styleUrl: './mod-options.component.scss',
})
export class ModOptionsComponent {
  readonly mod = input.required<Mod>();
  readonly surface = input<'popup' | 'options'>('popup');
  readonly svc = inject(ModOptionsService);
}
