import { Injectable, signal, computed, inject } from '@angular/core';
import { PaymentTransaction, PaymentMethod, MechanicPerformance, AccountsReceivableItem } from '../models/finance.model';
import { WorkOrderService } from './work-order.service';

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private workOrderService = inject(WorkOrderService);

  private readonly _transactions = signal<PaymentTransaction[]>([
    {
      id: 'TXN-001',
      receiptNumber: 'REC-0012',
      workOrderId: 'WO-101',
      orderNumber: 'OT-2026-001',
      clientName: 'Fernando Garza',
      vehiclePlate: 'ABC-1234',
      amount: 1000.00,
      paymentMethod: 'tarjeta',
      paymentMethodLabel: 'Tarjeta de Crédito / Débito',
      date: '2026-09-27 09:15',
      concept: 'Anticipo 50% de reparación de frenos',
      cashierName: 'Sofía Herrera',
      mechanicId: 'MEC-01',
      mechanicName: 'Roberto Valdés'
    },
    {
      id: 'TXN-002',
      receiptNumber: 'REC-0013',
      workOrderId: 'WO-102',
      orderNumber: 'OT-2026-002',
      clientName: 'Mariana Ríos',
      vehiclePlate: 'NXY-7721',
      amount: 3323.40,
      paymentMethod: 'transferencia',
      paymentMethodLabel: 'Transferencia Bancaria SPEI',
      date: '2026-09-27 15:10',
      concept: 'Liquidación total servicio de afinación mayor',
      cashierName: 'Sofía Herrera',
      mechanicId: 'MEC-02',
      mechanicName: 'Alejandro Morales'
    },
    {
      id: 'TXN-003',
      receiptNumber: 'REC-0014',
      workOrderId: 'WO-103',
      orderNumber: 'OT-2026-003',
      clientName: 'Transportes Express del Centro',
      vehiclePlate: 'PZA-4590',
      amount: 2000.00,
      paymentMethod: 'transferencia',
      paymentMethodLabel: 'Transferencia Bancaria SPEI',
      date: '2026-09-27 11:45',
      concept: 'Anticipo para compra de amortiguadores',
      cashierName: 'Carlos Mendoza',
      mechanicId: 'MEC-03',
      mechanicName: 'Luis Fernando Ruiz'
    },
    {
      id: 'TXN-004',
      receiptNumber: 'REC-0010',
      workOrderId: 'WO-099',
      orderNumber: 'OT-2026-000',
      clientName: 'Juan Carlos Benítez',
      vehiclePlate: 'TRK-2210',
      amount: 850.00,
      paymentMethod: 'efectivo',
      paymentMethodLabel: 'Efectivo en Caja',
      date: '2026-09-26 18:20',
      concept: 'Diagnóstico por escáner y afinación básica',
      cashierName: 'Sofía Herrera',
      mechanicId: 'MEC-02',
      mechanicName: 'Alejandro Morales'
    }
  ]);

  public readonly transactions = this._transactions.asReadonly();

  // Total recaudado hoy
  public readonly todayIncome = computed(() => {
    const today = '2026-09-27';
    return this._transactions()
      .filter(t => t.date.startsWith(today))
      .reduce((sum, t) => sum + t.amount, 0);
  });

  // Total recaudado mes
  public readonly monthlyIncome = computed(() => {
    return this._transactions().reduce((sum, t) => sum + t.amount, 0);
  });

  // Desglose por método de pago
  public readonly paymentMethodBreakdown = computed(() => {
    const breakdown: Record<PaymentMethod, { label: string; count: number; total: number; percentage: number }> = {
      efectivo: { label: 'Efectivo', count: 0, total: 0, percentage: 0 },
      tarjeta: { label: 'Tarjeta Débito/Crédito', count: 0, total: 0, percentage: 0 },
      transferencia: { label: 'Transferencia SPEI', count: 0, total: 0, percentage: 0 },
      digital: { label: 'Enlace Digital / QR', count: 0, total: 0, percentage: 0 }
    };

    const txns = this._transactions();
    let totalGeneral = 0;

    for (const t of txns) {
      if (breakdown[t.paymentMethod]) {
        breakdown[t.paymentMethod].count++;
        breakdown[t.paymentMethod].total += t.amount;
        totalGeneral += t.amount;
      }
    }

    if (totalGeneral > 0) {
      for (const key of Object.keys(breakdown) as PaymentMethod[]) {
        breakdown[key].percentage = Math.round((breakdown[key].total / totalGeneral) * 100);
      }
    }

    return breakdown;
  });

  // Desglose por mecánico (facturación y comisiones)
  public readonly mechanicPerformance = computed<MechanicPerformance[]>(() => {
    const mechanics = this.workOrderService.mechanics;
    const orders = this.workOrderService.orders();

    return mechanics.map(mec => {
      const mecOrders = orders.filter(o => o.mechanicId === mec.id);
      const completedOrders = mecOrders.filter(o => o.status === 'entregado' || o.status === 'listo_entrega').length;
      
      // Calcular mano de obra facturada por este mecánico
      let totalLabor = 0;
      for (const order of mecOrders) {
        for (const item of order.items) {
          if (item.type === 'mano_de_obra') {
            totalLabor += item.total;
          }
        }
      }

      const commissionRate = 18; // 18% de comisión sobre mano de obra
      const commissionEarned = Math.round(totalLabor * (commissionRate / 100));

      return {
        mechanicId: mec.id,
        mechanicName: mec.name,
        completedOrders,
        totalLaborBilled: totalLabor,
        commissionRate,
        commissionEarned
      };
    });
  });

  // Cuentas por cobrar
  public readonly accountsReceivable = computed<AccountsReceivableItem[]>(() => {
    return this.workOrderService.orders()
      .filter(o => o.balance > 0)
      .map(o => ({
        workOrderId: o.id,
        orderNumber: o.orderNumber,
        clientName: o.clientName,
        clientPhone: o.clientPhone,
        vehiclePlate: o.vehiclePlate,
        totalOrder: o.total,
        advancePaid: o.advancePaid,
        pendingBalance: o.balance,
        daysPending: 1,
        status: o.status
      }));
  });

  // Registrar nuevo pago / anticipo
  public registerPayment(data: {
    workOrderId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    concept: string;
    cashierName?: string;
  }): PaymentTransaction | null {
    const order = this.workOrderService.getOrderById(data.workOrderId);
    if (!order) return null;

    const receiptNumber = `REC-${String(this._transactions().length + 15).padStart(4, '0')}`;
    const methodLabels: Record<PaymentMethod, string> = {
      efectivo: 'Efectivo en Caja',
      tarjeta: 'Tarjeta Débito/Crédito',
      transferencia: 'Transferencia Bancaria SPEI',
      digital: 'Enlace Digital / QR'
    };

    const newTxn: PaymentTransaction = {
      id: `TXN-${Date.now().toString().slice(-4)}`,
      receiptNumber,
      workOrderId: order.id,
      orderNumber: order.orderNumber,
      clientName: order.clientName,
      vehiclePlate: order.vehiclePlate,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      paymentMethodLabel: methodLabels[data.paymentMethod] || 'Otro',
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      concept: data.concept,
      cashierName: data.cashierName || 'Caja Central',
      mechanicId: order.mechanicId,
      mechanicName: order.mechanicName
    };

    this._transactions.update(list => [newTxn, ...list]);
    this.workOrderService.updatePaymentBalance(order.id, data.amount);

    return newTxn;
  }
}
