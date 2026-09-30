import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WorkOrderService } from '../../core/services/work-order.service';
import { NotificationService } from '../../core/services/notification.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { WorkOrder, WorkOrderStatus } from '../../core/models/work-order.model';

@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './tracking.component.html',
  styleUrl: './tracking.component.css'
})
export class TrackingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private workOrderService = inject(WorkOrderService);
  public notifService = inject(NotificationService);

  order = signal<WorkOrder | null>(null);
  token = signal<string>('');

  steps: { key: WorkOrderStatus; label: string; icon: string; desc: string }[] = [
    { key: 'diagnostico', label: 'Recepción & Diagnóstico', icon: 'wrench', desc: 'Inspección inicial y escaneo computarizado' },
    { key: 'esperando_repuestos', label: 'Gestión de Repuestos', icon: 'package', desc: 'Asignación de insumos originales en almacén' },
    { key: 'en_reparacion', label: 'En Reparación', icon: 'wrench', desc: 'Trabajo técnico activo por mecánico especialista' },
    { key: 'listo_entrega', label: 'Listo para Entrega', icon: 'check-circle', desc: 'Control de calidad superado y listo para retiro' },
    { key: 'entregado', label: 'Vehículo Entregado', icon: 'check', desc: 'Unidad retirada por el cliente con garantía' }
  ];

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const tokenParam = params['token'] || 'TRK-9821';
      this.token.set(tokenParam);
      const found = this.workOrderService.getOrderByTrackingToken(tokenParam);
      if (found) {
        this.order.set(found);
      } else {
        // Fallback to first available order for demo
        this.order.set(this.workOrderService.orders()[0]);
      }
    });
  }

  isStepActive(stepKey: WorkOrderStatus): boolean {
    const current = this.order()?.status;
    if (!current) return false;
    const orderIndex = this.steps.findIndex(s => s.key === current);
    const stepIndex = this.steps.findIndex(s => s.key === stepKey);
    return stepIndex <= orderIndex;
  }

  isCurrentStep(stepKey: WorkOrderStatus): boolean {
    return this.order()?.status === stepKey;
  }

  contactAdvisorWhatsApp(): void {
    const ord = this.order();
    if (!ord) return;
    const msg = `Hola MELECSA 👋, soy ${ord.clientName}, tengo dudas sobre mi orden de servicio ${ord.orderNumber} para mi vehículo ${ord.vehiclePlate}.`;
    const url = this.notifService.generateWhatsAppUrl('+525541238890', msg);
    window.open(url, '_blank');
  }

  getStatusLabel(status: WorkOrderStatus): string {
    const found = this.steps.find(s => s.key === status);
    return found ? found.label : status;
  }

  getStatusIcon(status: WorkOrderStatus): string {
    const found = this.steps.find(s => s.key === status);
    return found ? found.icon : 'wrench';
  }

  getStatusBadgeClass(status: WorkOrderStatus): string {
    return 'badge-' + status;
  }
}
