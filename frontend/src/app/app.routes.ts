import { Routes } from '@angular/router';
import { adminOnly, signedIn, signedOut } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing').then((m) => m.Landing) },
  { path: 'login', canActivate: [signedOut], data: { mode: 'login' }, loadComponent: () => import('./pages/auth').then((m) => m.Auth) },
  { path: 'register', canActivate: [signedOut], data: { mode: 'register' }, loadComponent: () => import('./pages/auth').then((m) => m.Auth) },
  {
    path: 'panel',
    canActivate: [signedIn],
    loadComponent: () => import('./pages/panel/layout').then((m) => m.PanelLayout),
    children: [
      { path: '', data: { title: 'Welcome back, {user}', nav: 'overview' }, loadComponent: () => import('./pages/panel/overview').then((m) => m.PanelOverview) },
      { path: 'accounts', data: { title: 'Accounts', nav: 'accounts' }, loadComponent: () => import('./pages/panel/accounts').then((m) => m.PanelAccounts) },
      { path: 'billing', data: { title: 'Billing', nav: 'plans' }, loadComponent: () => import('./pages/panel/billing').then((m) => m.PanelBilling) },
      { path: 'orders', data: { title: 'Billing', nav: 'plans', focus: 'orders' }, loadComponent: () => import('./pages/panel/billing').then((m) => m.PanelBilling) },
      { path: 'profile', data: { title: 'Profile', nav: 'profile' }, loadComponent: () => import('./pages/panel/profile').then((m) => m.PanelProfile) },
      { path: 'settings', data: { title: 'Profile', nav: 'profile' }, loadComponent: () => import('./pages/panel/profile').then((m) => m.PanelProfile) },
      { path: '**', redirectTo: '' },
    ],
  },
  {
    path: 'admin',
    canActivate: [adminOnly],
    loadComponent: () => import('./pages/admin/layout').then((m) => m.AdminLayout),
    children: [
      { path: '', data: { title: 'Overview', sub: 'Revenue, subscribers and bot health at a glance', nav: 'overview' }, loadComponent: () => import('./pages/admin/overview').then((m) => m.AdminOverview) },
      { path: 'orders', data: { title: 'Orders', sub: 'Verify payments and activate plans', nav: 'orders' }, loadComponent: () => import('./pages/admin/orders').then((m) => m.AdminOrders) },
      { path: 'users', data: { title: 'Users', sub: 'Access time, account limits and suspensions', nav: 'users' }, loadComponent: () => import('./pages/admin/users').then((m) => m.AdminUsers) },
      { path: 'plans', data: { title: 'Plans & pricing', sub: 'Price, access duration and account limit for each plan', nav: 'plans' }, loadComponent: () => import('./pages/admin/plans').then((m) => m.AdminPlans) },
      { path: 'keys', data: { title: 'License keys', sub: 'Generate keys to sell outside the website', nav: 'keys' }, loadComponent: () => import('./pages/admin/keys').then((m) => m.AdminKeys) },
      { path: 'accounts', data: { title: 'All accounts', sub: 'Every Free Fire account running on the bot', nav: 'accounts' }, loadComponent: () => import('./pages/admin/accounts').then((m) => m.AdminAccounts) },
      { path: 'logs', data: { title: 'Live console', sub: 'Real-time bot output', nav: 'logs' }, loadComponent: () => import('./pages/admin/logs').then((m) => m.AdminLogs) },
      { path: 'settings', data: { title: 'Settings', sub: 'Branding, payments and support', nav: 'settings' }, loadComponent: () => import('./pages/admin/settings').then((m) => m.AdminSettings) },
      { path: '**', redirectTo: '' },
    ],
  },
  { path: '**', redirectTo: '' },
];
