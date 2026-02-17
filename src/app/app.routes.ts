import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'add-device',
    loadComponent: () => import('./add-device/add-device.page').then( m => m.AddDevicePage)
  },
  {
    path: 'device-setup',
    loadComponent: () => import('./add-device/selected/selected.page').then( m => m.SelectedPage)
  },
  {
    path: 'plant/:id',
    loadComponent: () => import('./plant-detail/plant-detail.page').then( m => m.PlantDetailPage)
  },
];
