import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/services/auth.service';
import { WorkOrderService } from '../core/services/work-order.service';
import { InventoryService } from '../core/services/inventory.service';
import { BudgetService } from '../core/services/budget.service';
import { NotificationService } from '../core/services/notification.service';
import { IconComponent } from '../shared/components/icon/icon.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule, IconComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {
  public authService = inject(AuthService);
  public workOrderService = inject(WorkOrderService);
  public inventoryService = inject(InventoryService);
  public budgetService = inject(BudgetService);
  public notifService = inject(NotificationService);
  private router = inject(Router);

  isSidebarCollapsed = signal(false);
  isNotifOpen = signal(false);
  globalSearchText = '';

  navItems = [
    {
      label: 'Panel de Control',
      sublabel: 'Métricas & Alertas',
      route: '/dashboard',
      icon: 'gauge'
    },
    {
      label: 'Recepción y Órdenes (OT)',
      sublabel: 'Checklist & Estados',
      route: '/ordenes',
      icon: 'car',
      getBadge: () => this.workOrderService.activeOrdersCount(),
      badgeClass: 'badge-active'
    },
    {
      label: 'Presupuestos e Historial',
      sublabel: 'Cotizaciones & Placas',
      route: '/presupuestos',
      icon: 'file-text',
      getBadge: () => this.budgetService.pendingBudgetsCount(),
      badgeClass: 'badge-pending'
    },
    {
      label: 'Control de Inventario',
      sublabel: 'Stock & Alertas Mínimas',
      route: '/inventario',
      icon: 'package',
      getBadge: () => this.inventoryService.lowStockCount(),
      badgeClass: 'badge-danger'
    },
    {
      label: 'Caja, Pagos y Cuentas',
      sublabel: 'Anticipos & Reportes',
      route: '/caja',
      icon: 'credit-card'
    },
    {
      label: 'Técnicos & Mecánicos',
      sublabel: 'Especialistas & Bahías',
      route: '/tecnicos',
      icon: 'wrench'
    },
    {
      label: 'Gestión de Usuarios',
      sublabel: 'Roles & Accesos',
      route: '/usuarios',
      icon: 'users'
    },
    {
      label: 'Portal Seguimiento Cliente',
      sublabel: 'Vista Móvil en Vivo',
      route: '/seguimiento/TRK-9821',
      icon: 'external-link'
    }
  ];

  toggleSidebar(): void {
    this.isSidebarCollapsed.update(v => !v);
  }

  toggleNotifications(): void {
    this.isNotifOpen.update(v => !v);
  }

  closeNotifications(): void {
    this.isNotifOpen.set(false);
  }

  onGlobalSearch(): void {
    const query = this.globalSearchText.trim();
    if (!query) return;

    // Redirige a presupuestos/historial o búsqueda de orden
    this.router.navigate(['/presupuestos'], { queryParams: { q: query } });
  }

  logout(): void {
    this.authService.logout();
  }
}
