import { Routes } from '@angular/router';

export const popupRoutes: Routes = [
    {
        path: '', loadComponent: () => import('./popup-index/popup-index.component').then(m => m.PopupIndexComponent)
    }
];
