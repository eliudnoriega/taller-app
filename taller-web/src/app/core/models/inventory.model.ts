export interface InventoryCategory {
  id: number;
  nombre: string;
  descripcion?: string | null;
  total_repuestos?: number;
}

export interface InventoryItem {
  id: string; // Compatible with existing usages (String(id))
  numericId?: number;
  code: string;
  codigo_sku?: string;
  name: string;
  nombre?: string;
  category: string;
  categoria_nombre?: string;
  categoria_id?: number;
  stock: number;
  stock_actual?: number;
  minStock: number;
  stock_minimo?: number;
  costPrice: number;
  costo_compra?: number;
  salePrice: number;
  precio_venta?: number;
  location: string;
  ubicacion_almacen?: string;
  unit: string;
  unidad_medida?: string;
  foto_producto?: string | null;
  descripcion?: string | null;
  margen_bruto_unitario?: number;
  margen_porcentual?: number;
  es_alerta_stock?: boolean | number;
  lastRestocked?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StockMovement {
  id: string | number;
  itemId: string;
  repuesto_id?: number;
  itemName: string;
  type: 'entrada' | 'salida_ot' | 'ajuste' | string;
  tipo_movimiento?: string;
  quantity: number;
  cantidad?: number;
  date: string;
  fecha_movimiento?: string;
  workOrderId?: string;
  numero_ot?: string;
  orden_trabajo_id?: number | null;
  reason: string;
  motivo?: string;
  performedBy: string;
  usuario_nombre?: string;
  stock_anterior?: number;
  stock_posterior?: number;
  costo_unitario?: number;
  precio_unitario?: number;
}

export interface StockAlert {
  id: number;
  codigo_sku: string;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
  deficit_unidades: number;
  costo_compra: number;
  costo_reposicion_estimado: number;
  unidad_medida: string;
  ubicacion_almacen: string;
  categoria_nombre: string;
}
