import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: 'popup', loadChildren: () => import('./popup/popup.routes').then(r => r.popupRoutes) },
    { path: 'option', loadChildren: () => import('./option/option.routes').then(r => r.optionRoutes) }
];
