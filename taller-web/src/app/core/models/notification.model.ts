export interface InternalNotification {
  id: string;
  type: 'stock_minimo' | 'ot_lista' | 'nuevo_presupuesto' | 'pago_recibido';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

export interface ClientNotificationLog {
  id: string;
  orderNumber: string;
  clientName: string;
  channel: 'whatsapp' | 'email';
  recipient: string;
  messagePreview: string;
  sentAt: string;
  status: 'enviado' | 'entregado';
}
