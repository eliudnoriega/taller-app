import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../core/services/finance.service';
import { WorkOrderService } from '../../core/services/work-order.service';
import { NotificationService } from '../../core/services/notification.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PaymentMethod, PaymentTransaction } from '../../core/models/finance.model';

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './cash-register.component.html',
  styleUrl: './cash-register.component.css'
})
export class CashRegisterComponent {
  public financeService = inject(FinanceService);
  public workOrderService = inject(WorkOrderService);
  public notifService = inject(NotificationService);

  activeTab = signal<'transacciones' | 'cuentas_cobrar' | 'reportes'>('transacciones');
  isPaymentModalOpen = signal(false);
  toastMessage = signal<string | null>(null);

  // New Payment form
  paymentForm = {
    workOrderId: '',
    amount: 1000,
    paymentMethod: 'tarjeta' as PaymentMethod,
    concept: 'Anticipo 50% de reparación'
  };

  openPaymentModal(workOrderId?: string): void {
    if (workOrderId) {
      this.paymentForm.workOrderId = workOrderId;
      const order = this.workOrderService.getOrderById(workOrderId);
      if (order) {
        this.paymentForm.amount = order.balance;
        this.paymentForm.concept = `Liquidación de orden ${order.orderNumber}`;
      }
    } else {
      const pending = this.workOrderService.orders().find(o => o.balance > 0);
      if (pending) {
        this.paymentForm.workOrderId = pending.id;
        this.paymentForm.amount = pending.balance;
      }
    }
    this.isPaymentModalOpen.set(true);
  }

  closePaymentModal(): void {
    this.isPaymentModalOpen.set(false);
  }

  onOrderSelected(): void {
    const order = this.workOrderService.getOrderById(this.paymentForm.workOrderId);
    if (order) {
      this.paymentForm.amount = order.balance;
    }
  }

  savePayment(): void {
    if (!this.paymentForm.workOrderId || this.paymentForm.amount <= 0) {
      alert('Por favor seleccione una orden e ingrese un monto válido.');
      return;
    }

    const txn = this.financeService.registerPayment({
      workOrderId: this.paymentForm.workOrderId,
      amount: this.paymentForm.amount,
      paymentMethod: this.paymentForm.paymentMethod,
      concept: this.paymentForm.concept
    });

    if (txn) {
      this.closePaymentModal();
      this.showToast(`Pago de $${txn.amount} registrado con recibo ${txn.receiptNumber}`);
    }
  }

  sendDebtReminderWhatsApp(item: { clientName: string; clientPhone: string; orderNumber: string; pendingBalance: number; vehiclePlate: string }): void {
    const msg = `Hola ${item.clientName} 👋, le saludamos de *MELECSA Taller*. Le recordamos que mantiene un saldo pendiente de *$${item.pendingBalance.toFixed(2)} MXN* por el servicio de su vehículo (Placa: ${item.vehiclePlate}, Orden: ${item.orderNumber}).\n\nPuede liquidar vía transferencia o en mostrador. ¡Muchas gracias!`;
    const url = this.notifService.generateWhatsAppUrl(item.clientPhone, msg);
    window.open(url, '_blank');
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3500);
  }
}
