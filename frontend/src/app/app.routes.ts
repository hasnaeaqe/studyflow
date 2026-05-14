import { Routes } from '@angular/router';
import { LandingComponent } from './modules/landing/landing.component';
import { LoginComponent } from './modules/auth/login/login.component';
import { RegisterComponent } from './modules/auth/register/register.component';
import { MainLayoutComponent } from './modules/admin/layouts/main-layout/main-layout.component';
import { DashboardComponent } from './modules/dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: '/landing', pathMatch: 'full' },
  { path: 'landing', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  
  // Route admin avec layout
  {
  path: 'admin',
  component: MainLayoutComponent,
  children: [
    { path: 'dashboard', loadComponent: () => import('./modules/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent) },
    { path: 'users', loadComponent: () => import('./modules/admin/users-management/users-management.component').then(m => m.UsersManagementComponent) },
    { path: 'sessions', loadComponent: () => import('./modules/admin/sessions-management/sessions-management.component').then(m => m.SessionsManagementComponent) },
    { path: 'groups', loadComponent: () => import('./modules/admin/groups-management/groups-management.component').then(m => m.GroupsManagementComponent) },
    { path: 'productivity', loadComponent: () => import('./modules/admin/productivity/productivity.component').then(m => m.ProductivityComponent) },
    { path: 'logs', loadComponent: () => import('./modules/admin/system-logs/system-logs.component').then(m => m.SystemLogsComponent) },
    { path: 'profile', loadComponent: () => import('./modules/profile/profile.component').then(m => m.ProfileComponent) },
    { path: 'notifications', loadComponent: () => import('./modules/admin/notifications-management/notifications-management.component').then(m => m.NotificationsManagementComponent) }
  ]
},
  
  // ⭐ ROUTE ÉTUDIANT (sans layout car il a sa propre sidebar)
  { 
    path: 'dashboard', 
    component: DashboardComponent 
  },

  { path: '**', redirectTo: '/landing' }
];