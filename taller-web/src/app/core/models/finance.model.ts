export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'digital';

export interface PaymentTransaction {
  id: string;
  receiptNumber: string; // REC-0042
  workOrderId: string;
  orderNumber: string;
  clientName: string;
  vehiclePlate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentMethodLabel: string;
  date: string;
  concept: string; // ej. Anticipo 50%, Liquidación total, Pago parcial
  cashierName: string;
  mechanicId: string;
  mechanicName: string;
}

export interface MechanicPerformance {
  mechanicId: string;
  mechanicName: string;
  completedOrders: number;
  totalLaborBilled: number;
  commissionRate: number; // porcentaje ej 15%
  commissionEarned: number;
}

export interface AccountsReceivableItem {
  workOrderId: string;
  orderNumber: string;
  clientName: string;
  clientPhone: string;
  vehiclePlate: string;
  totalOrder: number;
  advancePaid: number;
  pendingBalance: number;
  daysPending: number;
  status: string;
}
