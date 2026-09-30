import { Injectable, signal, computed, inject } from '@angular/core';
import { InternalNotification, ClientNotificationLog } from '../models/notification.model';
import { InventoryService } from './inventory.service';
import { WorkOrder } from '../models/work-order.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private inventoryService = inject(InventoryService);

  private readonly _clientLogs = signal<ClientNotificationLog[]>([
    {
      id: 'NOTIF-01',
      orderNumber: 'OT-2026-002',
      clientName: 'Mariana Ríos',
      channel: 'whatsapp',
      recipient: '+52 55 4433 2211',
      messagePreview: '¡Hola Mariana! Tu vehículo Volkswagen Golf [NXY-7721] está LISTO PARA ENTREGA en MELECSA. Consulta tu orden: ...',
      sentAt: '2026-09-27 14:02',
      status: 'entregado'
    },
    {
      id: 'NOTIF-02',
      orderNumber: 'OT-2026-001',
      clientName: 'Fernando Garza',
      channel: 'email',
      recipient: 'fgarza@empresa.mx',
      messagePreview: 'Estimado Fernando, tu orden de trabajo OT-2026-001 ha iniciado proceso de reparación en frenos.',
      sentAt: '2026-09-27 09:30',
      status: 'entregado'
    }
  ]);

  private readonly _dismissedNotifications = signal<string[]>([]);

  public readonly clientLogs = this._clientLogs.asReadonly();

  // Alertas internas reactivas automáticas
  public readonly internalNotifications = computed<InternalNotification[]>(() => {
    const notifications: InternalNotification[] = [];
    const dismissed = this._dismissedNotifications();

    // 1. Alerta de Stock Mínimo
    const lowStock = this.inventoryService.lowStockItems();
    if (lowStock.length > 0 && !dismissed.includes('stock-alert')) {
      notifications.push({
        id: 'stock-alert',
        type: 'stock_minimo',
        title: 'Alerta de Insumos Críticos',
        message: `Hay ${lowStock.length} productos por debajo del stock mínimo (${lowStock.map(i => i.name).slice(0, 2).join(', ')}...).`,
        timestamp: 'Hace unos momentos',
        read: false,
        link: '/inventario'
      });
    }

    // 2. Alertas de órdenes listas para entrega
    notifications.push({
      id: 'notif-ot-ready',
      type: 'ot_lista',
      title: 'Vehículo Listo para Entrega',
      message: 'La orden OT-2026-002 (Volkswagen Golf NXY-7721) está finalizada y lista para retiro.',
      timestamp: 'Hoy 14:00',
      read: false,
      link: '/ordenes'
    });

    return notifications;
  });

  public readonly unreadCount = computed(() => {
    return this.internalNotifications().filter(n => !n.read).length;
  });

  public getTrackingUrl(trackingToken: string): string {
    const origin = window.location.origin;
    return `${origin}/seguimiento/${trackingToken}`;
  }

  public generateWhatsAppUrl(phone: string, message: string): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encoded}`;
  }

  public sendCustomerWhatsAppNotice(order: WorkOrder, customMessage?: string): { success: boolean; url: string } {
    const trackingUrl = this.getTrackingUrl(order.trackingToken);
    const defaultMsg = `Hola ${order.clientName} 👋, le saludamos de *MELECSA Taller*. ` +
      `Le informamos sobre su vehículo *${order.vehicleDescription}* (Placa: ${order.vehiclePlate}). ` +
      `\n\n📌 *Estado actual:* ${order.status.toUpperCase().replace('_', ' ')}` +
      `\n🔗 *Enlace de seguimiento en tiempo real y fotos:* ${trackingUrl}` +
      `\n💰 Saldo pendiente: $${order.balance.toFixed(2)} MXN.` +
      `\n\n¡Quedamos atentos a cualquier duda!`;

    const finalMsg = customMessage || defaultMsg;
    const waUrl = this.generateWhatsAppUrl(order.clientPhone, finalMsg);

    const log: ClientNotificationLog = {
      id: `LOG-${Date.now().toString().slice(-4)}`,
      orderNumber: order.orderNumber,
      clientName: order.clientName,
      channel: 'whatsapp',
      recipient: order.clientPhone,
      messagePreview: finalMsg.slice(0, 90) + '...',
      sentAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'enviado'
    };

    this._clientLogs.update(logs => [log, ...logs]);
    return { success: true, url: waUrl };
  }

  public sendCustomerEmailNotice(order: WorkOrder): { success: boolean; log: ClientNotificationLog } {
    const trackingUrl = this.getTrackingUrl(order.trackingToken);
    const preview = `Actualización de estatus de orden ${order.orderNumber} para ${order.vehiclePlate}. Seguimiento: ${trackingUrl}`;

    const log: ClientNotificationLog = {
      id: `LOG-${Date.now().toString().slice(-4)}`,
      orderNumber: order.orderNumber,
      clientName: order.clientName,
      channel: 'email',
      recipient: order.clientEmail || 'cliente@correo.com',
      messagePreview: preview,
      sentAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'enviado'
    };

    this._clientLogs.update(logs => [log, ...logs]);
    return { success: true, log };
  }
}
