import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WorkOrderService } from '../../core/services/work-order.service';
import { InventoryService } from '../../core/services/inventory.service';
import { FinanceService } from '../../core/services/finance.service';
import { NotificationService } from '../../core/services/notification.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { WorkOrder } from '../../core/models/work-order.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  public workOrderService = inject(WorkOrderService);
  public inventoryService = inject(InventoryService);
  public financeService = inject(FinanceService);
  public notifService = inject(NotificationService);

  selectedOrderForNotif = signal<WorkOrder | null>(null);
  toastMessage = signal<string | null>(null);

  // Status badges config
  statusMap: Record<string, { label: string; class: string; icon: string }> = {
    diagnostico: { label: 'En Diagnóstico', class: 'badge-diagnostico', icon: 'wrench' },
    esperando_repuestos: { label: 'Esperando Repuestos', class: 'badge-esperando_repuestos', icon: 'package' },
    en_reparacion: { label: 'En Reparación', class: 'badge-en_reparacion', icon: 'wrench' },
    listo_entrega: { label: 'Listo para Entrega', class: 'badge-listo_entrega', icon: 'check-circle' },
    entregado: { label: 'Entregado', class: 'badge-entregado', icon: 'check' }
  };

  openNotificationModal(order: WorkOrder): void {
    this.selectedOrderForNotif.set(order);
  }

  closeNotificationModal(): void {
    this.selectedOrderForNotif.set(null);
  }

  sendWhatsApp(order: WorkOrder): void {
    const res = this.notifService.sendCustomerWhatsAppNotice(order);
    this.workOrderService.recordClientNotification(order.id);
    this.closeNotificationModal();
    window.open(res.url, '_blank');
    this.showToast(`Mensaje preparado para enviar vía WhatsApp a ${order.clientName}`);
  }

  sendEmail(order: WorkOrder): void {
    this.notifService.sendCustomerEmailNotice(order);
    this.workOrderService.recordClientNotification(order.id);
    this.closeNotificationModal();
    this.showToast(`Notificación por correo enviada exitosamente a ${order.clientEmail}`);
  }

  copyTrackingLink(token: string): void {
    const url = this.notifService.getTrackingUrl(token);
    navigator.clipboard.writeText(url).then(() => {
      this.showToast('Enlace de seguimiento copiado al portapapeles');
    }).catch(() => {
      this.showToast(`Enlace: ${url}`);
    });
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3500);
  }
}
