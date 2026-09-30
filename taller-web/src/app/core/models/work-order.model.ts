export type WorkOrderStatus =
  | 'diagnostico'
  | 'esperando_repuestos'
  | 'en_reparacion'
  | 'listo_entrega'
  | 'entregado';

export type PriorityLevel = 'baja' | 'media' | 'alta' | 'urgente';

export interface InspectionChecklist {
  fuelLevel: 0 | 25 | 50 | 75 | 100; // Porcentaje de combustible
  bodyNotes: string; // Rayones, abolladuras, etc.
  spareTire: boolean; // Rueda de auxilio
  hydraulicJack: boolean; // Gato hidráulico
  wheelWrench: boolean; // Llave de tuercas
  vehicleDocuments: boolean; // Tarjeta de circulación / papeles
  cleanExterior: boolean;
  batteryWorking: boolean;
  airConditioning: boolean;
  lightsWorking: boolean;
  photos: string[]; // URLs o descripciones de evidencia fotográfica
}

export interface WorkOrderItem {
  id: string;
  type: 'repuesto' | 'mano_de_obra';
  inventoryItemId?: string; // Vinculación con inventario para descuento automático
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface OrderStatusComment {
  id: string;
  status: WorkOrderStatus;
  comment: string;
  timestamp: string;
  author: string;
}

export interface WorkOrder {
  id: string;
  orderNumber: string; // ej. OT-2026-001
  trackingToken: string; // Token para seguimiento del cliente sin login ej. TRK-7842
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleDescription: string; // ej. Toyota Corolla 2021 Blanco
  vehicleMileage: number;
  entryDate: string;
  estimatedDeliveryDate: string;
  deliveryDate?: string;
  status: WorkOrderStatus;
  priority: PriorityLevel;
  mechanicId: string;
  mechanicName: string;
  failureDescription: string;
  technicalDiagnosis?: string;
  checklist: InspectionChecklist;
  items: WorkOrderItem[];
  subtotal: number;
  tax: number; // IVA 16%
  total: number;
  advancePaid: number; // Anticipos pagados
  balance: number; // Saldo pendiente
  paymentStatus: 'pendiente' | 'parcial' | 'liquidado';
  inventoryDeducted: boolean; // Si ya se descargaron los repuestos de inventario
  fromBudgetId?: string; // Si provino de una cotización
  clientNotifiedAt?: string;
  statusComments: OrderStatusComment[];
}
