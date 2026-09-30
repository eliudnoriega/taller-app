import { Injectable, signal, computed, inject } from '@angular/core';
import { WorkOrder, WorkOrderStatus, WorkOrderItem, InspectionChecklist, OrderStatusComment } from '../models/work-order.model';
import { Mechanic, Client, Vehicle, RegisteredVehicle } from '../models/client-vehicle.model';
import { InventoryService } from './inventory.service';
import { TechnicianService } from './technician.service';

@Injectable({
  providedIn: 'root'
})
export class WorkOrderService {
  private inventoryService = inject(InventoryService);

  private readonly _registeredVehicles = signal<RegisteredVehicle[]>([
    {
      plate: 'ABC-1234',
      description: 'Toyota Corolla 2021 Blanco Perlado',
      clientName: 'Fernando Garza',
      clientPhone: '+52 55 9876 5432',
      clientEmail: 'fgarza@empresa.mx',
      mileage: 48500
    },
    {
      plate: 'NXY-7721',
      description: 'Volkswagen Golf TSI 2020 Gris Carbón',
      clientName: 'Mariana Ríos',
      clientPhone: '+52 55 4433 2211',
      clientEmail: 'marianarios@gmail.com',
      mileage: 62000
    },
    {
      plate: 'PZA-4590',
      description: 'Nissan NP300 Frontier 2019 Blanca',
      clientName: 'Transportes Express del Centro',
      clientPhone: '+52 55 1290 8877',
      clientEmail: 'flotilla@expresst.com',
      mileage: 115000
    },
    {
      plate: 'HZM-9012',
      description: 'Mazda CX-5 2022 Rojo Brillante',
      clientName: 'Dra. Gabriela Fuentes',
      clientPhone: '+52 55 6677 8899',
      clientEmail: 'gabyfuentes@medica.org',
      mileage: 32000
    },
    {
      plate: 'JTR-8812',
      description: 'Honda Civic Turbo 2022 Azul Marino',
      clientName: 'Lic. Ricardo Morales',
      clientPhone: '+52 55 3322 1199',
      clientEmail: 'rmorales@bufete.com',
      mileage: 38000
    },
    {
      plate: 'KLP-3349',
      description: 'Chevrolet Tracker 2021 Plateada',
      clientName: 'Patricia Valenzuela',
      clientPhone: '+52 55 9988 7766',
      clientEmail: 'paty.valenzuela@gmail.com',
      mileage: 54000
    }
  ]);

  private technicianService = inject(TechnicianService);

  public readonly registeredVehicles = this._registeredVehicles.asReadonly();

  public get mechanics(): Mechanic[] {
    return this.technicianService.technicians();
  }

  private readonly _orders = signal<WorkOrder[]>([
    {
      id: 'WO-101',
      orderNumber: 'OT-2026-001',
      trackingToken: 'TRK-9821',
      clientId: 'CLI-01',
      clientName: 'Fernando Garza',
      clientPhone: '+52 55 9876 5432',
      clientEmail: 'fgarza@empresa.mx',
      vehicleId: 'VEH-01',
      vehiclePlate: 'ABC-1234',
      vehicleDescription: 'Toyota Corolla 2021 Blanco Perlado',
      vehicleMileage: 48500,
      entryDate: '2026-09-27 08:30',
      estimatedDeliveryDate: '2026-09-28 17:00',
      status: 'en_reparacion',
      priority: 'alta',
      mechanicId: 'MEC-01',
      mechanicName: 'Roberto Valdés',
      failureDescription: 'Ruido metálico al frenar en el eje delantero y vibración en el volante a más de 80 km/h.',
      technicalDiagnosis: 'Desgaste severo en pastillas de freno delanteras (menos de 2mm) y discos con leve alabeo. Requiere rectificado y cambio de pastillas.',
      checklist: {
        fuelLevel: 50,
        bodyNotes: 'Pequeño raspón superficial en paragolpes trasero derecho. Sin golpes graves.',
        spareTire: true,
        hydraulicJack: true,
        wheelWrench: true,
        vehicleDocuments: true,
        cleanExterior: true,
        batteryWorking: true,
        airConditioning: true,
        lightsWorking: true,
        photos: [
          'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=500',
          'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&q=80&w=500'
        ]
      },
      items: [
        {
          id: 'ITM-01',
          type: 'repuesto',
          inventoryItemId: 'INV-003',
          description: 'Juego Pastillas de Freno Cerámicas Delanteras',
          quantity: 1,
          unitPrice: 680.00,
          total: 680.00
        },
        {
          id: 'ITM-02',
          type: 'repuesto',
          inventoryItemId: 'INV-004',
          description: 'Líquido de Frenos DOT 4 500ml',
          quantity: 1,
          unitPrice: 140.00,
          total: 140.00
        },
        {
          id: 'ITM-03',
          type: 'mano_de_obra',
          description: 'Mano de obra: Cambio de frenos y purgado completo de sistema hidráulico',
          quantity: 2,
          unitPrice: 450.00,
          total: 900.00
        }
      ],
      subtotal: 1720.00,
      tax: 275.20,
      total: 1995.20,
      advancePaid: 1000.00,
      balance: 995.20,
      paymentStatus: 'parcial',
      inventoryDeducted: false,
      statusComments: [
        {
          id: 'SC-101-1',
          status: 'diagnostico',
          comment: 'Recepción inicial. Se confirma ruido metálico al frenar y vibración en el eje delantero.',
          timestamp: '2026-09-27 08:45',
          author: 'Roberto Valdés'
        },
        {
          id: 'SC-101-2',
          status: 'en_reparacion',
          comment: 'Desmontaje de calipers completado. Iniciando rectificado de discos e instalación de pastillas cerámicas.',
          timestamp: '2026-09-27 10:30',
          author: 'Roberto Valdés'
        }
      ]
    },
    {
      id: 'WO-102',
      orderNumber: 'OT-2026-002',
      trackingToken: 'TRK-3341',
      clientId: 'CLI-02',
      clientName: 'Mariana Ríos',
      clientPhone: '+52 55 4433 2211',
      clientEmail: 'marianarios@gmail.com',
      vehicleId: 'VEH-02',
      vehiclePlate: 'NXY-7721',
      vehicleDescription: 'Volkswagen Golf TSI 2020 Gris Carbón',
      vehicleMileage: 62000,
      entryDate: '2026-09-26 10:15',
      estimatedDeliveryDate: '2026-09-27 15:00',
      status: 'listo_entrega',
      priority: 'media',
      mechanicId: 'MEC-02',
      mechanicName: 'Alejandro Morales',
      failureDescription: 'Mantenimiento preventivo de los 60,000 km y encendido intermitente de testigo Check Engine.',
      technicalDiagnosis: 'Código P0301 (Fallo de encendido en cilindro 1 por bujía carbonizada). Se realizó afinación mayor completa, reemplazo de 4 bujías de iridio y filtros.',
      checklist: {
        fuelLevel: 75,
        bodyNotes: 'Excelente estado de carrocería. Rines sin raspones.',
        spareTire: true,
        hydraulicJack: true,
        wheelWrench: true,
        vehicleDocuments: true,
        cleanExterior: true,
        batteryWorking: true,
        airConditioning: true,
        lightsWorking: true,
        photos: [
          'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=500'
        ]
      },
      items: [
        {
          id: 'ITM-04',
          type: 'repuesto',
          inventoryItemId: 'INV-002',
          description: 'Aceite de Motor 5W-30 Full Sintético 4L',
          quantity: 1,
          unitPrice: 720.00,
          total: 720.00
        },
        {
          id: 'ITM-05',
          type: 'repuesto',
          inventoryItemId: 'INV-001',
          description: 'Filtro de Aceite Sintético Premium',
          quantity: 1,
          unitPrice: 195.00,
          total: 195.00
        },
        {
          id: 'ITM-06',
          type: 'repuesto',
          inventoryItemId: 'INV-005',
          description: 'Bujía de Iridio Laser (Pack x4)',
          quantity: 1,
          unitPrice: 850.00,
          total: 850.00
        },
        {
          id: 'ITM-07',
          type: 'mano_de_obra',
          description: 'Servicio de afinación mayor y reseteo de scanner OBD2',
          quantity: 1,
          unitPrice: 1100.00,
          total: 1100.00
        }
      ],
      subtotal: 2865.00,
      tax: 458.40,
      total: 3323.40,
      advancePaid: 3323.40,
      balance: 0,
      paymentStatus: 'liquidado',
      inventoryDeducted: true,
      clientNotifiedAt: '2026-09-27 14:00',
      statusComments: [
        {
          id: 'SC-102-1',
          status: 'diagnostico',
          comment: 'Escaneo con scanner OBD2 confirma falla de encendido en cilindro 1 (P0301). Bujía número 1 carbonizada.',
          timestamp: '2026-09-26 10:30',
          author: 'Alejandro Morales'
        },
        {
          id: 'SC-102-2',
          status: 'en_reparacion',
          comment: 'Afinación concluida: 4 bujías de iridio nuevas, cambio de aceite sintético 5W-30 y filtro.',
          timestamp: '2026-09-26 16:20',
          author: 'Alejandro Morales'
        },
        {
          id: 'SC-102-3',
          status: 'listo_entrega',
          comment: 'Prueba de ruta superada satisfactoriamente. Unidad lavada y lista para retiro en bahía de entrega.',
          timestamp: '2026-09-27 11:00',
          author: 'Alejandro Morales'
        }
      ]
    },
    {
      id: 'WO-103',
      orderNumber: 'OT-2026-003',
      trackingToken: 'TRK-5512',
      clientId: 'CLI-03',
      clientName: 'Transportes Express del Centro',
      clientPhone: '+52 55 1290 8877',
      clientEmail: 'flotilla@expresst.com',
      vehicleId: 'VEH-03',
      vehiclePlate: 'PZA-4590',
      vehicleDescription: 'Nissan NP300 Frontier 2019 Blanca',
      vehicleMileage: 115000,
      entryDate: '2026-09-27 11:00',
      estimatedDeliveryDate: '2026-09-29 18:00',
      status: 'esperando_repuestos',
      priority: 'urgente',
      mechanicId: 'MEC-03',
      mechanicName: 'Luis Fernando Ruiz',
      failureDescription: 'Golpeteo seco en la suspensión delantera al pasar baches e inestabilidad en carretera.',
      technicalDiagnosis: 'Amortiguadores delanteros con fuga de aceite hidráulico y bujes de horquilla reventados.',
      checklist: {
        fuelLevel: 25,
        bodyNotes: 'Vehículo utilitario de carga con desgaste normal de uso. Caja con rayones.',
        spareTire: true,
        hydraulicJack: true,
        wheelWrench: false,
        vehicleDocuments: true,
        cleanExterior: false,
        batteryWorking: true,
        airConditioning: true,
        lightsWorking: false,
        photos: [
          'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=500'
        ]
      },
      items: [
        {
          id: 'ITM-08',
          type: 'repuesto',
          inventoryItemId: 'INV-006',
          description: 'Amortiguador Delantero a Gas Reforzado (Par)',
          quantity: 2,
          unitPrice: 1450.00,
          total: 2900.00
        },
        {
          id: 'ITM-09',
          type: 'mano_de_obra',
          description: 'Desmontaje de suspensión delantera, cambio de amortiguadores y alineación láser',
          quantity: 1,
          unitPrice: 1200.00,
          total: 1200.00
        }
      ],
      subtotal: 4100.00,
      tax: 656.00,
      total: 4756.00,
      advancePaid: 2000.00,
      balance: 2756.00,
      paymentStatus: 'parcial',
      inventoryDeducted: false,
      statusComments: [
        {
          id: 'SC-103-1',
          status: 'diagnostico',
          comment: 'Revisión en fosa: vástagos de amortiguadores torcidos y bujes de horquillas totalmente degradados.',
          timestamp: '2026-09-27 11:20',
          author: 'Luis Fernando Ruiz'
        },
        {
          id: 'SC-103-2',
          status: 'esperando_repuestos',
          comment: 'Se solicitó par de amortiguadores reforzados a proveedor. Entrega confirmada para mañana a primera hora.',
          timestamp: '2026-09-27 12:45',
          author: 'Luis Fernando Ruiz'
        }
      ]
    },
    {
      id: 'WO-104',
      orderNumber: 'OT-2026-004',
      trackingToken: 'TRK-1198',
      clientId: 'CLI-04',
      clientName: 'Dra. Gabriela Fuentes',
      clientPhone: '+52 55 6677 8899',
      clientEmail: 'gabyfuentes@medica.org',
      vehicleId: 'VEH-04',
      vehiclePlate: 'HZM-9012',
      vehicleDescription: 'Mazda CX-5 2022 Rojo Brillante',
      vehicleMileage: 32000,
      entryDate: '2026-09-27 14:30',
      estimatedDeliveryDate: '2026-09-28 12:00',
      status: 'diagnostico',
      priority: 'media',
      mechanicId: 'MEC-01',
      mechanicName: 'Roberto Valdés',
      failureDescription: 'El aire acondicionado no enfría lo suficiente y huele a humedad al encender.',
      technicalDiagnosis: 'Revisión en proceso. Presión de gas baja y filtro antipolen saturado.',
      checklist: {
        fuelLevel: 100,
        bodyNotes: 'Vehículo impecable sin detalles estéticos.',
        spareTire: true,
        hydraulicJack: true,
        wheelWrench: true,
        vehicleDocuments: true,
        cleanExterior: true,
        batteryWorking: true,
        airConditioning: false,
        lightsWorking: true,
        photos: [
          'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=500'
        ]
      },
      items: [
        {
          id: 'ITM-10',
          type: 'repuesto',
          inventoryItemId: 'INV-009',
          description: 'Filtro de Aire de Cabina Antipolen',
          quantity: 1,
          unitPrice: 220.00,
          total: 220.00
        },
        {
          id: 'ITM-11',
          type: 'mano_de_obra',
          description: 'Carga de gas ecológico R134a y sanitización por ozono',
          quantity: 1,
          unitPrice: 850.00,
          total: 850.00
        }
      ],
      subtotal: 1070.00,
      tax: 171.20,
      total: 1241.20,
      advancePaid: 0,
      balance: 1241.20,
      paymentStatus: 'pendiente',
      inventoryDeducted: false,
      statusComments: [
        {
          id: 'SC-104-1',
          status: 'diagnostico',
          comment: 'Presión en baja marca 18 PSI (deficiente). Filtro de habitáculo obstruido con polvo y polen.',
          timestamp: '2026-09-27 14:45',
          author: 'Roberto Valdés'
        }
      ]
    }
  ]);

  public readonly orders = this._orders.asReadonly();

  // Computed counters
  public readonly totalOrdersCount = computed(() => this._orders().length);

  public readonly activeOrdersCount = computed(() => {
    return this._orders().filter(o => o.status !== 'entregado').length;
  });

  public readonly readyForDeliveryCount = computed(() => {
    return this._orders().filter(o => o.status === 'listo_entrega').length;
  });

  public readonly statusCounts = computed(() => {
    const list = this._orders();
    return {
      diagnostico: list.filter(o => o.status === 'diagnostico').length,
      esperando_repuestos: list.filter(o => o.status === 'esperando_repuestos').length,
      en_reparacion: list.filter(o => o.status === 'en_reparacion').length,
      listo_entrega: list.filter(o => o.status === 'listo_entrega').length,
      entregado: list.filter(o => o.status === 'entregado').length,
    };
  });

  public readonly accountsReceivableTotal = computed(() => {
    return this._orders()
      .filter(o => o.balance > 0)
      .reduce((sum, o) => sum + o.balance, 0);
  });

  public getOrderById(id: string): WorkOrder | undefined {
    return this._orders().find(o => o.id === id || o.orderNumber === id);
  }

  public getOrderByTrackingToken(token: string): WorkOrder | undefined {
    return this._orders().find(o => 
      o.trackingToken.toLowerCase() === token.toLowerCase() ||
      o.orderNumber.toLowerCase() === token.toLowerCase()
    );
  }

  public addOrder(orderData: Partial<WorkOrder>): WorkOrder {
    const nextNum = this._orders().length + 1;
    const orderNumber = `OT-2026-${String(nextNum).padStart(3, '0')}`;
    const trackingToken = `TRK-${Math.floor(1000 + Math.random() * 9000)}`;

    const subtotal = orderData.items?.reduce((s, itm) => s + itm.total, 0) || 0;
    const tax = Math.round(subtotal * 0.16 * 100) / 100;
    const total = subtotal + tax;
    const advancePaid = orderData.advancePaid || 0;
    const balance = Math.max(0, total - advancePaid);
    const paymentStatus = balance === 0 ? 'liquidado' : (advancePaid > 0 ? 'parcial' : 'pendiente');

    const newOrder: WorkOrder = {
      id: `WO-${Date.now().toString().slice(-4)}`,
      orderNumber,
      trackingToken,
      clientId: orderData.clientId || `CLI-${Date.now().toString().slice(-3)}`,
      clientName: orderData.clientName || 'Cliente General',
      clientPhone: orderData.clientPhone || '',
      clientEmail: orderData.clientEmail || '',
      vehicleId: orderData.vehicleId || `VEH-${Date.now().toString().slice(-3)}`,
      vehiclePlate: orderData.vehiclePlate?.toUpperCase() || 'SIN-PLACA',
      vehicleDescription: orderData.vehicleDescription || 'Vehículo no especificado',
      vehicleMileage: orderData.vehicleMileage || 0,
      entryDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
      estimatedDeliveryDate: orderData.estimatedDeliveryDate || '',
      status: orderData.status || 'diagnostico',
      priority: orderData.priority || 'media',
      mechanicId: orderData.mechanicId || 'MEC-01',
      mechanicName: orderData.mechanicName || 'Roberto Valdés',
      failureDescription: orderData.failureDescription || '',
      technicalDiagnosis: orderData.technicalDiagnosis || '',
      checklist: orderData.checklist || {
        fuelLevel: 50,
        bodyNotes: 'Sin detalles reportados',
        spareTire: true,
        hydraulicJack: true,
        wheelWrench: true,
        vehicleDocuments: true,
        cleanExterior: true,
        batteryWorking: true,
        airConditioning: true,
        lightsWorking: true,
        photos: []
      },
      items: orderData.items || [],
      subtotal,
      tax,
      total,
      advancePaid,
      balance,
      paymentStatus,
      inventoryDeducted: false,
      fromBudgetId: orderData.fromBudgetId,
      statusComments: orderData.statusComments || [
        {
          id: `SC-${Date.now()}`,
          status: orderData.status || 'diagnostico',
          comment: 'Recepción y apertura de orden de servicio en MELECSA.',
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          author: orderData.mechanicName || 'Recepción MELECSA'
        }
      ]
    };

    this._orders.update(list => [newOrder, ...list]);

    // Registrar o actualizar datos del vehículo en el catálogo del taller
    if (newOrder.vehiclePlate && newOrder.vehiclePlate !== 'SIN-PLACA') {
      this.registerOrUpdateVehicle({
        plate: newOrder.vehiclePlate,
        description: newOrder.vehicleDescription,
        clientName: newOrder.clientName,
        clientPhone: newOrder.clientPhone,
        clientEmail: newOrder.clientEmail,
        mileage: newOrder.vehicleMileage
      });
    }

    return newOrder;
  }

  public addStatusComment(
    orderId: string,
    comment: string,
    status?: WorkOrderStatus,
    author?: string
  ): OrderStatusComment | undefined {
    const order = this._orders().find(o => o.id === orderId);
    if (!order || !comment.trim()) return undefined;

    const targetStatus = status || order.status;
    const newComment: OrderStatusComment = {
      id: `SC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      status: targetStatus,
      comment: comment.trim(),
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      author: author || 'Técnico MELECSA'
    };

    this._orders.update(list => list.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          statusComments: [newComment, ...(o.statusComments || [])]
        };
      }
      return o;
    }));

    return newComment;
  }

  public addItemToOrder(
    orderId: string,
    itemData: Omit<WorkOrderItem, 'id' | 'total'> & { id?: string }
  ): WorkOrder | undefined {
    const order = this._orders().find(o => o.id === orderId);
    if (!order) return undefined;

    const qty = Number(itemData.quantity) > 0 ? Number(itemData.quantity) : 1;
    const unitPrice = Number(itemData.unitPrice) >= 0 ? Number(itemData.unitPrice) : 0;
    const itemTotal = Math.round(qty * unitPrice * 100) / 100;

    const newItem: WorkOrderItem = {
      id: itemData.id || `ITM-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      type: itemData.type,
      inventoryItemId: itemData.inventoryItemId,
      description: itemData.description,
      quantity: qty,
      unitPrice: unitPrice,
      total: itemTotal
    };

    const updatedItems = [...order.items, newItem];
    const subtotal = Math.round(updatedItems.reduce((s, itm) => s + itm.total, 0) * 100) / 100;
    const tax = Math.round(subtotal * 0.16 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const balance = Math.max(0, Math.round((total - order.advancePaid) * 100) / 100);
    const paymentStatus = balance === 0 ? 'liquidado' : (order.advancePaid > 0 ? 'parcial' : 'pendiente');

    // Si ya está entregado con inventario descontado y se añade un repuesto de almacén
    if (order.status === 'entregado' && order.inventoryDeducted && newItem.type === 'repuesto' && newItem.inventoryItemId) {
      this.inventoryService.deductPartsForWorkOrder([newItem], order.orderNumber);
    }

    let updatedOrder: WorkOrder | undefined;

    this._orders.update(list => list.map(o => {
      if (o.id === orderId) {
        updatedOrder = {
          ...o,
          items: updatedItems,
          subtotal,
          tax,
          total,
          balance,
          paymentStatus
        };
        return updatedOrder;
      }
      return o;
    }));

    return updatedOrder;
  }

  public removeItemFromOrder(orderId: string, itemId: string): WorkOrder | undefined {
    const order = this._orders().find(o => o.id === orderId);
    if (!order) return undefined;

    const updatedItems = order.items.filter(itm => itm.id !== itemId);
    const subtotal = Math.round(updatedItems.reduce((s, itm) => s + itm.total, 0) * 100) / 100;
    const tax = Math.round(subtotal * 0.16 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const balance = Math.max(0, Math.round((total - order.advancePaid) * 100) / 100);
    const paymentStatus = balance === 0 ? 'liquidado' : (order.advancePaid > 0 ? 'parcial' : 'pendiente');

    let updatedOrder: WorkOrder | undefined;

    this._orders.update(list => list.map(o => {
      if (o.id === orderId) {
        updatedOrder = {
          ...o,
          items: updatedItems,
          subtotal,
          tax,
          total,
          balance,
          paymentStatus
        };
        return updatedOrder;
      }
      return o;
    }));

    return updatedOrder;
  }

  public updateOrderStatus(orderId: string, newStatus: WorkOrderStatus, comment?: string, author?: string): void {
    const order = this._orders().find(o => o.id === orderId);
    if (!order) return;

    // Si se pasa a entregado o listo_entrega y aún no se ha descargado el inventario
    let deductInventory = false;
    if (newStatus === 'entregado' && !order.inventoryDeducted) {
      this.inventoryService.deductPartsForWorkOrder(order.items, order.orderNumber);
      deductInventory = true;
    }

    const statusLabels: Record<WorkOrderStatus, string> = {
      diagnostico: 'En Diagnóstico',
      esperando_repuestos: 'Esperando Repuestos',
      en_reparacion: 'En Reparación',
      listo_entrega: 'Listo para Entrega',
      entregado: 'Entregado'
    };

    const commentText = comment && comment.trim()
      ? comment.trim()
      : `Estado operativo actualizado a: ${statusLabels[newStatus] || newStatus}`;

    const newComment: OrderStatusComment = {
      id: `SC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      status: newStatus,
      comment: commentText,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      author: author || order.mechanicName || 'Técnico MELECSA'
    };

    this._orders.update(list => list.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: newStatus,
          inventoryDeducted: deductInventory ? true : o.inventoryDeducted,
          deliveryDate: newStatus === 'entregado' ? new Date().toISOString().replace('T', ' ').slice(0, 16) : o.deliveryDate,
          statusComments: [newComment, ...(o.statusComments || [])]
        };
      }
      return o;
    }));
  }

  public updatePaymentBalance(orderId: string, paymentAmount: number): void {
    this._orders.update(list => list.map(o => {
      if (o.id === orderId) {
        const newAdvance = o.advancePaid + paymentAmount;
        const newBalance = Math.max(0, o.total - newAdvance);
        const newPaymentStatus = newBalance === 0 ? 'liquidado' : (newAdvance > 0 ? 'parcial' : 'pendiente');
        return {
          ...o,
          advancePaid: newAdvance,
          balance: newBalance,
          paymentStatus: newPaymentStatus
        };
      }
      return o;
    }));
  }

  public findVehicleByPlate(plate: string): RegisteredVehicle | undefined {
    if (!plate) return undefined;
    const clean = plate.trim().toUpperCase();
    return this._registeredVehicles().find(v => v.plate.toUpperCase() === clean);
  }

  public registerOrUpdateVehicle(vehicle: RegisteredVehicle): void {
    if (!vehicle.plate) return;
    const cleanPlate = vehicle.plate.trim().toUpperCase();
    const existingIndex = this._registeredVehicles().findIndex(v => v.plate.toUpperCase() === cleanPlate);
    if (existingIndex === -1) {
      this._registeredVehicles.update(list => [{ ...vehicle, plate: cleanPlate }, ...list]);
    } else {
      this._registeredVehicles.update(list => {
        const copy = [...list];
        copy[existingIndex] = {
          ...copy[existingIndex],
          description: copy[existingIndex].description || vehicle.description,
          clientName: vehicle.clientName || copy[existingIndex].clientName,
          clientPhone: vehicle.clientPhone || copy[existingIndex].clientPhone,
          clientEmail: vehicle.clientEmail || copy[existingIndex].clientEmail,
          mileage: vehicle.mileage || copy[existingIndex].mileage
        };
        return copy;
      });
    }
  }

  public recordClientNotification(orderId: string): void {
    this._orders.update(list => list.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          clientNotifiedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
        };
      }
      return o;
    }));
  }
}
