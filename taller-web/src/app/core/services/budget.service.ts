import { Injectable, signal, computed, inject } from '@angular/core';
import { Budget, BudgetStatus, VehicleClinicalHistory } from '../models/budget.model';
import { WorkOrderService } from './work-order.service';
import { WorkOrder } from '../models/work-order.model';

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private workOrderService = inject(WorkOrderService);

  private readonly _budgets = signal<Budget[]>([
    {
      id: 'COT-01',
      budgetNumber: 'COT-2026-088',
      clientId: 'CLI-05',
      clientName: 'Lic. Ricardo Morales',
      clientPhone: '+52 55 3322 1199',
      clientEmail: 'rmorales@bufete.com',
      vehiclePlate: 'JTR-8812',
      vehicleDescription: 'Honda Civic Turbo 2022 Azul Marino',
      vehicleMileage: 38000,
      createdAt: '2026-09-27 12:00',
      validUntil: '2026-10-12',
      status: 'aprobado',
      estimatedLaborHours: 3.5,
      notes: 'Presupuesto para cambio preventivo de banda de accesorios y afinación programada.',
      items: [
        {
          id: 'BITM-01',
          type: 'repuesto',
          inventoryItemId: 'INV-002',
          description: 'Aceite de Motor 5W-30 Full Sintético 4L',
          quantity: 1,
          unitPrice: 720.00,
          total: 720.00
        },
        {
          id: 'BITM-02',
          type: 'repuesto',
          inventoryItemId: 'INV-001',
          description: 'Filtro de Aceite Sintético Premium',
          quantity: 1,
          unitPrice: 195.00,
          total: 195.00
        },
        {
          id: 'BITM-03',
          type: 'repuesto',
          inventoryItemId: 'INV-005',
          description: 'Bujía de Iridio Laser (Pack x4)',
          quantity: 1,
          unitPrice: 850.00,
          total: 850.00
        },
        {
          id: 'BITM-04',
          type: 'mano_de_obra',
          description: 'Mano de obra especializada Honda afinación y revisión 40 puntos',
          quantity: 1,
          unitPrice: 950.00,
          total: 950.00
        }
      ],
      subtotal: 2715.00,
      tax: 434.40,
      total: 3149.40
    },
    {
      id: 'COT-02',
      budgetNumber: 'COT-2026-089',
      clientId: 'CLI-06',
      clientName: 'Patricia Valenzuela',
      clientPhone: '+52 55 9988 7766',
      clientEmail: 'paty.valenzuela@gmail.com',
      vehiclePlate: 'KLP-3349',
      vehicleDescription: 'Chevrolet Tracker 2021 Plateada',
      vehicleMileage: 54000,
      createdAt: '2026-09-26 16:30',
      validUntil: '2026-10-10',
      status: 'enviado',
      estimatedLaborHours: 4,
      notes: 'Cotización por reemplazo de amortiguadores y bujes de horquilla.',
      items: [
        {
          id: 'BITM-05',
          type: 'repuesto',
          inventoryItemId: 'INV-006',
          description: 'Amortiguador Delantero a Gas Reforzado (Par)',
          quantity: 2,
          unitPrice: 1450.00,
          total: 2900.00
        },
        {
          id: 'BITM-06',
          type: 'mano_de_obra',
          description: 'Mano de obra cambio de amortiguadores y alineación',
          quantity: 1,
          unitPrice: 1200.00,
          total: 1200.00
        }
      ],
      subtotal: 4100.00,
      tax: 656.00,
      total: 4756.00
    }
  ]);

  // Historial clínico mockeado de vehículos frecuentes
  private readonly _clinicalHistories: Record<string, VehicleClinicalHistory> = {
    'ABC-1234': {
      vehiclePlate: 'ABC-1234',
      vehicleDescription: 'Toyota Corolla 2021 Blanco Perlado',
      ownerName: 'Fernando Garza',
      vin: '3TYB12456K992188',
      totalVisits: 3,
      totalSpent: 6450.00,
      records: [
        {
          orderNumber: 'OT-2026-001',
          date: '2026-09-27',
          mileage: 48500,
          diagnosis: 'Desgaste de pastillas y discos de freno delanteros',
          replacedParts: ['Pastillas Cerámicas Delanteras', 'Líquido de Frenos DOT 4'],
          laborServices: ['Cambio de frenos y purgado de sistema hidráulico'],
          mechanicName: 'Roberto Valdés',
          totalAmount: 1995.20,
          status: 'En reparación',
          warrantyValidUntil: '2027-03-27 (6 meses)'
        },
        {
          orderNumber: 'OT-2026-015',
          date: '2026-04-12',
          mileage: 40000,
          diagnosis: 'Mantenimiento periódico preventivo de 40,000 km',
          replacedParts: ['Aceite Sintético 5W-30 4L', 'Filtro de Aceite', 'Filtro de Aire'],
          laborServices: ['Afinación preventiva y rotación de neumáticos'],
          mechanicName: 'Alejandro Morales',
          totalAmount: 2150.00,
          status: 'Entregado',
          warrantyValidUntil: '2026-10-12 (Vencida)'
        },
        {
          orderNumber: 'OT-2025-102',
          date: '2025-10-05',
          mileage: 30000,
          diagnosis: 'Cambio de batería por falla de carga matutina',
          replacedParts: ['Batería 12V 60Ah Libre Mantenimiento'],
          laborServices: ['Diagnóstico de alternador e instalación de acumulador'],
          mechanicName: 'Luis Fernando Ruiz',
          totalAmount: 2304.80,
          status: 'Entregado',
          warrantyValidUntil: '2027-10-05 (Garantía activa 2 años)'
        }
      ]
    },
    'NXY-7721': {
      vehiclePlate: 'NXY-7721',
      vehicleDescription: 'Volkswagen Golf TSI 2020 Gris Carbón',
      ownerName: 'Mariana Ríos',
      vin: '3VW219808M554210',
      totalVisits: 2,
      totalSpent: 5123.40,
      records: [
        {
          orderNumber: 'OT-2026-002',
          date: '2026-09-26',
          mileage: 62000,
          diagnosis: 'Check Engine P0301 y mantenimiento mayor 60k km',
          replacedParts: ['Aceite 5W-30', 'Filtro Aceite', 'Bujías Iridio Pack x4'],
          laborServices: ['Afinación mayor y escaneo computarizado'],
          mechanicName: 'Alejandro Morales',
          totalAmount: 3323.40,
          status: 'Listo para entrega',
          warrantyValidUntil: '2027-03-26'
        },
        {
          orderNumber: 'OT-2025-089',
          date: '2025-08-14',
          mileage: 49000,
          diagnosis: 'Cambio de líquido de frenos y pastillas traseras',
          replacedParts: ['Pastillas traseras', 'Líquido de frenos'],
          laborServices: ['Servicio de frenado y ajuste de freno de mano'],
          mechanicName: 'Roberto Valdés',
          totalAmount: 1800.00,
          status: 'Entregado',
          warrantyValidUntil: '2026-02-14'
        }
      ]
    }
  };

  public readonly budgets = this._budgets.asReadonly();

  public readonly pendingBudgetsCount = computed(() => {
    return this._budgets().filter(b => b.status === 'enviado' || b.status === 'aprobado').length;
  });

  public addBudget(budgetData: Partial<Budget>): Budget {
    const nextNum = this._budgets().length + 90;
    const budgetNumber = `COT-2026-${nextNum}`;
    const subtotal = budgetData.items?.reduce((s, itm) => s + itm.total, 0) || 0;
    const tax = Math.round(subtotal * 0.16 * 100) / 100;
    const total = subtotal + tax;

    const newBudget: Budget = {
      id: `COT-${Date.now().toString().slice(-4)}`,
      budgetNumber,
      clientId: budgetData.clientId || `CLI-${Date.now().toString().slice(-3)}`,
      clientName: budgetData.clientName || 'Cliente Particular',
      clientPhone: budgetData.clientPhone || '',
      clientEmail: budgetData.clientEmail || '',
      vehiclePlate: budgetData.vehiclePlate?.toUpperCase() || 'SIN-PLACA',
      vehicleDescription: budgetData.vehicleDescription || 'Vehículo General',
      vehicleMileage: budgetData.vehicleMileage || 0,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      validUntil: budgetData.validUntil || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      status: budgetData.status || 'enviado',
      estimatedLaborHours: budgetData.estimatedLaborHours || 2,
      notes: budgetData.notes || '',
      items: budgetData.items || [],
      subtotal,
      tax,
      total
    };

    this._budgets.update(list => [newBudget, ...list]);
    return newBudget;
  }

  public updateBudgetStatus(budgetId: string, status: BudgetStatus): void {
    this._budgets.update(list => list.map(b => b.id === budgetId ? { ...b, status } : b));
  }

  /**
   * CONVERSIÓN EN 1 CLIC: De Presupuesto a Orden de Trabajo (OT)
   */
  public convertBudgetToWorkOrder(budgetId: string): WorkOrder | null {
    const budget = this._budgets().find(b => b.id === budgetId);
    if (!budget) return null;

    // Crea la orden de trabajo en el servicio de OT
    const createdOT = this.workOrderService.addOrder({
      clientName: budget.clientName,
      clientPhone: budget.clientPhone,
      clientEmail: budget.clientEmail,
      vehiclePlate: budget.vehiclePlate,
      vehicleDescription: budget.vehicleDescription,
      vehicleMileage: budget.vehicleMileage,
      failureDescription: `Trabajo autorizado según cotización ${budget.budgetNumber}: ${budget.notes}`,
      items: budget.items,
      subtotal: budget.subtotal,
      tax: budget.tax,
      total: budget.total,
      advancePaid: 0,
      status: 'diagnostico',
      priority: 'alta',
      fromBudgetId: budget.id
    });

    // Actualiza el presupuesto a convertido
    this._budgets.update(list => list.map(b => {
      if (b.id === budgetId) {
        return {
          ...b,
          status: 'convertido_ot',
          convertedWorkOrderId: createdOT.orderNumber
        };
      }
      return b;
    }));

    return createdOT;
  }

  /**
   * Consulta de Historial Clínico completo por Placa o VIN
   */
  public getClinicalHistory(query: string): VehicleClinicalHistory | null {
    const cleanQuery = query.trim().toUpperCase();
    if (!cleanQuery) return null;

    // Buscar coincidencia exacta o parcial en la base mock
    for (const [plate, history] of Object.entries(this._clinicalHistories)) {
      if (plate.includes(cleanQuery) || history.vin.toUpperCase().includes(cleanQuery)) {
        return history;
      }
    }

    // Si coincide con alguna orden activa actual pero sin historial antiguo previo, armar expediente dinámico
    const currentOrders = this.workOrderService.orders().filter(o => 
      o.vehiclePlate.includes(cleanQuery) || o.orderNumber.includes(cleanQuery)
    );

    if (currentOrders.length > 0) {
      const first = currentOrders[0];
      return {
        vehiclePlate: first.vehiclePlate,
        vehicleDescription: first.vehicleDescription,
        ownerName: first.clientName,
        vin: 'VIN-VERIFICADO-EN-SISTEMA',
        totalVisits: currentOrders.length,
        totalSpent: currentOrders.reduce((acc, o) => acc + o.total, 0),
        records: currentOrders.map(o => ({
          orderNumber: o.orderNumber,
          date: o.entryDate.split(' ')[0],
          mileage: o.vehicleMileage,
          diagnosis: o.failureDescription,
          replacedParts: o.items.filter(i => i.type === 'repuesto').map(i => i.description),
          laborServices: o.items.filter(i => i.type === 'mano_de_obra').map(i => i.description),
          mechanicName: o.mechanicName,
          totalAmount: o.total,
          status: o.status,
          warrantyValidUntil: '90 días a partir de entrega'
        }))
      };
    }

    return null;
  }
}
