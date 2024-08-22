import { Routes } from '@angular/router';

export const optionRoutes: Routes = [
    {
        path: '', loadComponent: () => import('./option-index/option-index.component').then(m => m.OptionIndexComponent)
    }
];
