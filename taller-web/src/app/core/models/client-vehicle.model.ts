export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  idNumber: string; // DNI, RFC o Cédula
  address?: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  clientId: string;
  clientName?: string;
  plate: string;
  vin: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  mileage: number;
  engine?: string;
}

export interface RegisteredVehicle {
  plate: string;
  description: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  mileage?: number;
}

export interface Mechanic {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  email?: string;
  activeOrdersCount: number;
  completedOrdersCount?: number;
  avatar: string;
  status: 'activo' | 'inactivo' | 'vacaciones';
  hireDate?: string;
  rating?: number;
}

