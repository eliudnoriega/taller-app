import { WorkOrderItem } from './work-order.model';

export type BudgetStatus = 'borrador' | 'enviado' | 'aprobado' | 'rechazado' | 'convertido_ot';

export interface Budget {
  id: string;
  budgetNumber: string; // ej. COT-2026-089
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  vehiclePlate: string;
  vehicleDescription: string;
  vehicleMileage: number;
  createdAt: string;
  validUntil: string;
  status: BudgetStatus;
  items: WorkOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  estimatedLaborHours: number;
  notes: string;
  convertedWorkOrderId?: string;
}

export interface VehicleClinicalHistory {
  vehiclePlate: string;
  vehicleDescription: string;
  ownerName: string;
  vin: string;
  totalVisits: number;
  totalSpent: number;
  records: VehicleHistoryRecord[];
}

export interface VehicleHistoryRecord {
  orderNumber: string;
  date: string;
  mileage: number;
  diagnosis: string;
  replacedParts: string[];
  laborServices: string[];
  mechanicName: string;
  totalAmount: number;
  status: string;
  warrantyValidUntil: string;
}
