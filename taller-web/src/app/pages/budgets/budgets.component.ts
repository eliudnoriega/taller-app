import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BudgetService } from '../../core/services/budget.service';
import { InventoryService } from '../../core/services/inventory.service';
import { WorkOrderService } from '../../core/services/work-order.service';
import { NotificationService } from '../../core/services/notification.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { Budget, BudgetStatus, VehicleClinicalHistory } from '../../core/models/budget.model';
import { WorkOrderItem } from '../../core/models/work-order.model';
import { RegisteredVehicle } from '../../core/models/client-vehicle.model';

@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './budgets.component.html',
  styleUrl: './budgets.component.css'
})
export class BudgetsComponent implements OnInit {
  public budgetService = inject(BudgetService);
  public inventoryService = inject(InventoryService);
  public workOrderService = inject(WorkOrderService);
  public notifService = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  activeTab = signal<'cotizaciones' | 'historial'>('cotizaciones');
  searchTerm = signal<string>('');
  isCreateModalOpen = signal(false);
  selectedBudgetForDetail = signal<Budget | null>(null);
  toastMessage = signal<string | null>(null);

  // Control de Placa y Vehículo
  isExistingVehicle = signal<boolean>(false);
  isPlateDropdownOpen = signal<boolean>(false);

  // Historial Clínico search state
  historySearchPlate = 'ABC-1234';
  clinicalHistoryResult = signal<VehicleClinicalHistory | null>(null);

  // New Budget state
  newBudget = {
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    vehiclePlate: '',
    vehicleDescription: '',
    vehicleMileage: 40000,
    validUntil: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    notes: '',
    estimatedLaborHours: 3,
    items: [
      {
        id: 'BITM-1',
        type: 'mano_de_obra' as ('repuesto' | 'mano_de_obra'),
        description: 'Servicio de mantenimiento preventivo y ajuste de frenos',
        quantity: 1,
        unitPrice: 850,
        total: 850
      }
    ] as WorkOrderItem[]
  };

  newItemDesc = '';
  newItemType: 'repuesto' | 'mano_de_obra' = 'repuesto';
  newItemPrice = 450;
  newItemQty = 1;

  statusConfig: Record<BudgetStatus, { label: string; class: string }> = {
    borrador: { label: 'Borrador', class: 'badge-done' },
    enviado: { label: 'Enviado al Cliente', class: 'badge-esperando_repuestos' },
    aprobado: { label: 'Aprobado', class: 'badge-listo_entrega' },
    rechazado: { label: 'Rechazado', class: 'badge-danger' },
    convertido_ot: { label: 'Convertido a OT', class: 'badge-en_reparacion' }
  };

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['nuevo'] === 'true') {
        this.openCreateModal();
      }
      if (params['q']) {
        this.activeTab.set('historial');
        this.historySearchPlate = params['q'];
        this.searchHistory();
      }
    });

    // Default search for clinical history demo
    this.searchHistory();
  }

  get filteredBudgets(): Budget[] {
    const list = this.budgetService.budgets();
    const query = this.searchTerm().trim().toLowerCase();
    if (!query) return list;

    return list.filter(b => 
      b.budgetNumber.toLowerCase().includes(query) ||
      b.clientName.toLowerCase().includes(query) ||
      b.vehiclePlate.toLowerCase().includes(query) ||
      b.vehicleDescription.toLowerCase().includes(query)
    );
  }

  get matchingRegisteredVehicles(): RegisteredVehicle[] {
    const query = (this.newBudget.vehiclePlate || '').trim().toUpperCase();
    const all = this.workOrderService.registeredVehicles();
    if (!query) return all;
    return all.filter(v =>
      v.plate.toUpperCase().includes(query) ||
      v.description.toLowerCase().includes(query.toLowerCase()) ||
      v.clientName.toLowerCase().includes(query.toLowerCase())
    );
  }

  onPlateInput(value: string): void {
    const cleanPlate = (value || '').trim().toUpperCase();
    this.newBudget.vehiclePlate = cleanPlate;

    const found = this.workOrderService.findVehicleByPlate(cleanPlate);
    if (found) {
      this.isExistingVehicle.set(true);
      this.newBudget.vehicleDescription = found.description;
      if (!this.newBudget.clientName) {
        this.newBudget.clientName = found.clientName;
      }
      if (!this.newBudget.clientPhone && found.clientPhone) {
        this.newBudget.clientPhone = found.clientPhone;
      }
      if (!this.newBudget.clientEmail && found.clientEmail) {
        this.newBudget.clientEmail = found.clientEmail;
      }
      if (found.mileage) {
        this.newBudget.vehicleMileage = found.mileage;
      }
    } else {
      this.isExistingVehicle.set(false);
    }
  }

  selectExistingVehicle(vehicle: RegisteredVehicle): void {
    this.newBudget.vehiclePlate = vehicle.plate;
    this.newBudget.vehicleDescription = vehicle.description;
    this.newBudget.clientName = vehicle.clientName;
    this.newBudget.clientPhone = vehicle.clientPhone || '';
    this.newBudget.clientEmail = vehicle.clientEmail || '';
    if (vehicle.mileage) {
      this.newBudget.vehicleMileage = vehicle.mileage;
    }
    this.isExistingVehicle.set(true);
    this.isPlateDropdownOpen.set(false);
  }

  togglePlateDropdown(): void {
    this.isPlateDropdownOpen.update(v => !v);
  }

  closePlateDropdown(): void {
    this.isPlateDropdownOpen.set(false);
  }

  openCreateModal(): void {
    this.newBudget = {
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      vehiclePlate: '',
      vehicleDescription: '',
      vehicleMileage: 40000,
      validUntil: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      notes: '',
      estimatedLaborHours: 3,
      items: [
        {
          id: 'BITM-1',
          type: 'mano_de_obra',
          description: 'Servicio de mantenimiento preventivo y ajuste de frenos',
          quantity: 1,
          unitPrice: 850,
          total: 850
        }
      ]
    };
    this.isExistingVehicle.set(false);
    this.isPlateDropdownOpen.set(false);
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
    this.isPlateDropdownOpen.set(false);
  }

  onSelectInventoryProduct(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const invId = target.value;
    if (!invId) return;

    const item = this.inventoryService.items().find(i => i.id === invId);
    if (item) {
      this.newItemDesc = `${item.name} (${item.code})`;
      this.newItemPrice = item.salePrice;
      this.newItemType = 'repuesto';
    }
  }

  addItemToBudget(): void {
    if (!this.newItemDesc) return;
    this.newBudget.items.push({
      id: `BITM-${Date.now()}`,
      type: this.newItemType,
      description: this.newItemDesc,
      quantity: this.newItemQty,
      unitPrice: this.newItemPrice,
      total: this.newItemPrice * this.newItemQty
    });
    this.newItemDesc = '';
    this.newItemQty = 1;
    this.newItemPrice = 450;
  }

  removeItem(index: number): void {
    this.newBudget.items.splice(index, 1);
  }

  calculateSubtotal(): number {
    return this.newBudget.items.reduce((s, itm) => s + itm.total, 0);
  }

  saveBudget(): void {
    if (!this.newBudget.clientName || !this.newBudget.vehiclePlate) {
      alert('Por favor ingrese el nombre del cliente y la placa del vehículo.');
      return;
    }

    const created = this.budgetService.addBudget({
      clientName: this.newBudget.clientName,
      clientPhone: this.newBudget.clientPhone,
      clientEmail: this.newBudget.clientEmail,
      vehiclePlate: this.newBudget.vehiclePlate.toUpperCase(),
      vehicleDescription: this.newBudget.vehicleDescription || 'Vehículo General',
      vehicleMileage: this.newBudget.vehicleMileage,
      validUntil: this.newBudget.validUntil,
      notes: this.newBudget.notes,
      estimatedLaborHours: this.newBudget.estimatedLaborHours,
      items: [...this.newBudget.items]
    });

    this.closeCreateModal();
    this.showToast(`Cotización ${created.budgetNumber} creada exitosamente`);
  }

  /**
   * ACCIÓN ESTRELLA: Conversión en 1 Clic a Orden de Trabajo
   */
  convertBudgetToOT(budget: Budget): void {
    const createdOT = this.budgetService.convertBudgetToWorkOrder(budget.id);
    if (createdOT) {
      this.showToast(`⚡ ¡Cotización convertida con éxito en Orden de Trabajo ${createdOT.orderNumber}!`);
      setTimeout(() => {
        this.router.navigate(['/ordenes']);
      }, 1200);
    }
  }

  sendBudgetWhatsApp(budget: Budget): void {
    const msg = `Hola ${budget.clientName} 👋, le enviamos la cotización *${budget.budgetNumber}* para su vehículo ${budget.vehicleDescription} (Placa: ${budget.vehiclePlate}).\n\n` +
      `Total: *$${budget.total.toFixed(2)} MXN* (IVA incluido).\nVálido hasta: ${budget.validUntil}.\n\n` +
      `¿Desea autorizar el inicio de los trabajos en MELECSA?`;
    const url = this.notifService.generateWhatsAppUrl(budget.clientPhone || '5500000000', msg);
    window.open(url, '_blank');
  }

  searchHistory(): void {
    const query = this.historySearchPlate.trim();
    if (!query) {
      this.clinicalHistoryResult.set(null);
      return;
    }
    const history = this.budgetService.getClinicalHistory(query);
    this.clinicalHistoryResult.set(history);
  }

  quickSearchHistory(plate: string): void {
    this.historySearchPlate = plate;
    this.searchHistory();
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3500);
  }
}
