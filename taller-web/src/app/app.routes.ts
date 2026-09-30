import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { LayoutComponent } from './layout/layout.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { WorkOrdersComponent } from './pages/work-orders/work-orders.component';
import { BudgetsComponent } from './pages/budgets/budgets.component';
import { InventoryComponent } from './pages/inventory/inventory.component';
import { CashRegisterComponent } from './pages/cash-register/cash-register.component';
import { TrackingComponent } from './pages/tracking/tracking.component';
import { TechniciansComponent } from './pages/technicians/technicians.component';
import { UsersComponent } from './pages/users/users.component';

export const routes: Routes = [
  // 1. Pantalla Inicial: Login
  {
    path: 'login',
    component: LoginComponent,
    title: 'Iniciar Sesión | MELECSA'
  },

  // 2. Portal Público de Seguimiento para el Cliente (Sin login requerido)
  {
    path: 'seguimiento/:token',
    component: TrackingComponent,
    title: 'Seguimiento de Vehículo | MELECSA'
  },

  // 3. Sistema Interno con Sidebar (Protegido con AuthGuard)
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        title: 'Panel de Control y Notificaciones | MELECSA'
      },
      {
        path: 'ordenes',
        component: WorkOrdersComponent,
        title: 'Recepción y Órdenes de Trabajo (OT) | MELECSA'
      },
      {
        path: 'presupuestos',
        component: BudgetsComponent,
        title: 'Presupuestos e Historial Clínico | MELECSA'
      },
      {
        path: 'inventario',
        component: InventoryComponent,
        title: 'Control de Inventario y Repuestos | MELECSA'
      },
      {
        path: 'caja',
        component: CashRegisterComponent,
        title: 'Caja, Pagos y Cuentas por Cobrar | MELECSA'
      },
      {
        path: 'tecnicos',
        component: TechniciansComponent,
        title: 'Administración de Técnicos y Mecánicos | MELECSA'
      },
      {
        path: 'usuarios',
        component: UsersComponent,
        title: 'Administración de Usuarios del Sistema | MELECSA'
      }
    ]
  },

  // Redirección por defecto
  {
    path: '**',
    redirectTo: 'login'
  }
];
