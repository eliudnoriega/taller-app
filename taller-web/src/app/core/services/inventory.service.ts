import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of, forkJoin } from 'rxjs';
import { InventoryCategory, InventoryItem, StockAlert, StockMovement } from '../models/inventory.model';
import { WorkOrderItem } from '../models/work-order.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

interface ApiRepuesto {
  id: number;
  codigo_sku: string;
  categoria_id: number | null;
  nombre: string;
  descripcion: string | null;
  costo_compra: string | number;
  precio_venta: string | number;
  stock_actual: string | number;
  stock_minimo: string | number;
  unidad_medida: string;
  ubicacion_almacen: string | null;
  foto_producto: string | null;
  activo: number;
  created_at: string | null;
  updated_at: string | null;
  categoria_nombre: string | null;
  margen_bruto_unitario: string | number;
  margen_porcentual: string | number;
  es_alerta_stock: number | boolean;
}

interface ApiKardexItem {
  id: number;
  repuesto_id: number;
  tipo_movimiento: string;
  cantidad: string | number;
  costo_unitario: string | number | null;
  precio_unitario: string | number | null;
  stock_anterior: string | number;
  stock_posterior: string | number;
  orden_trabajo_id: number | null;
  usuario_id: number | null;
  motivo: string;
  fecha_movimiento: string;
  usuario_nombre: string | null;
  numero_ot: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private http = inject(HttpClient);

  public readonly API_BASE = 'http://localhost:8000/api';
  public readonly API_REPUESTOS_URL = `${this.API_BASE}/repuestos`;
  public readonly API_CATEGORIAS_URL = `${this.API_BASE}/categorias`;
  public readonly API_ALERTAS_URL = `${this.API_BASE}/repuestos/alertas-stock`;

  // Default fallback items in case API is offline
  private readonly defaultItems: InventoryItem[] = [
    {
      id: '1',
      numericId: 1,
      code: 'FRE-PAS-001',
      codigo_sku: 'FRE-PAS-001',
      name: 'Juego de Pastillas Delanteras Cerámica',
      nombre: 'Juego de Pastillas Delanteras Cerámica',
      category: 'Frenos y Seguridad',
      categoria_nombre: 'Frenos y Seguridad',
      categoria_id: 1,
      stock: 2,
      stock_actual: 2,
      minStock: 4,
      stock_minimo: 4,
      costPrice: 320.00,
      costo_compra: 320.00,
      salePrice: 650.00,
      precio_venta: 650.00,
      location: 'E-01-A',
      ubicacion_almacen: 'E-01-A',
      unit: 'JUEGO',
      unidad_medida: 'JUEGO',
      lastRestocked: '2026-09-27'
    },
    {
      id: '2',
      numericId: 2,
      code: 'FRE-LIQ-DOT4',
      codigo_sku: 'FRE-LIQ-DOT4',
      name: 'Líquido de Frenos DOT 4 500ml',
      nombre: 'Líquido de Frenos DOT 4 500ml',
      category: 'Frenos y Seguridad',
      categoria_nombre: 'Frenos y Seguridad',
      categoria_id: 1,
      stock: 3,
      stock_actual: 3,
      minStock: 5,
      stock_minimo: 5,
      costPrice: 60.00,
      costo_compra: 60.00,
      salePrice: 140.00,
      precio_venta: 140.00,
      location: 'E-01-B',
      ubicacion_almacen: 'E-01-B',
      unit: 'UNIDAD',
      unidad_medida: 'UNIDAD',
      lastRestocked: '2026-09-27'
    }
  ];

  private readonly _items = signal<InventoryItem[]>(this.defaultItems);
  private readonly _categories = signal<InventoryCategory[]>([]);
  private readonly _movements = signal<StockMovement[]>([]);
  private readonly _lowStockAlerts = signal<StockAlert[]>([]);

  public readonly isLoading = signal<boolean>(false);
  public readonly lastError = signal<string | null>(null);

  // Readonly signals
  public readonly items = this._items.asReadonly();
  public readonly categories = this._categories.asReadonly();
  public readonly movements = this._movements.asReadonly();
  public readonly lowStockAlerts = this._lowStockAlerts.asReadonly();

  // Automatic alerts for low / critical stock
  public readonly lowStockItems = computed(() => {
    return this._items().filter(item => item.stock <= item.minStock);
  });

  public readonly lowStockCount = computed(() => {
    const fromAlerts = this._lowStockAlerts().length;
    return fromAlerts > 0 ? fromAlerts : this.lowStockItems().length;
  });

  // Financial totals of inventory
  public readonly totalInventoryCost = computed(() => {
    return this._items().reduce((acc, item) => acc + (item.stock * item.costPrice), 0);
  });

  public readonly totalInventorySaleValue = computed(() => {
    return this._items().reduce((acc, item) => acc + (item.stock * item.salePrice), 0);
  });

  public readonly estimatedInventoryMargin = computed(() => {
    const cost = this.totalInventoryCost();
    const sale = this.totalInventorySaleValue();
    if (cost === 0) return 0;
    return Math.round(((sale - cost) / cost) * 100);
  });

  constructor() {
    this.loadAll();
  }

  /**
   * Sincronizar todos los datos de inventario con el backend PHP en localhost:8000
   */
  public async loadAll(): Promise<void> {
    this.isLoading.set(true);
    this.lastError.set(null);

    try {
      await Promise.allSettled([
        this.loadCategories(),
        this.loadAlerts(),
        this.loadItems()
      ]);
      // Kardex needs items loaded to resolve product names properly
      await this.loadMovements();
    } catch (e: any) {
      this.lastError.set(e?.message || 'Error cargando datos de inventario');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Cargar listado de repuestos y refacciones desde GET /api/repuestos
   */
  public async loadItems(): Promise<InventoryItem[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<ApiRepuesto[]>>(this.API_REPUESTOS_URL).pipe(
          catchError(err => {
            console.warn('No se pudo conectar a GET /api/repuestos en localhost:8000, usando cache local:', err);
            return of(null);
          })
        )
      );

      if (res && res.success && Array.isArray(res.data)) {
        const mapped = res.data.map(item => this.mapApiToInventoryItem(item));
        this._items.set(mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Error al obtener repuestos:', e);
    }
    return this._items();
  }

  /**
   * Cargar categorías desde GET /api/categorias
   */
  public async loadCategories(): Promise<InventoryCategory[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<InventoryCategory[]>>(this.API_CATEGORIAS_URL).pipe(
          catchError(err => {
            console.warn('No se pudo conectar a GET /api/categorias:', err);
            return of(null);
          })
        )
      );

      if (res && res.success && Array.isArray(res.data)) {
        this._categories.set(res.data);
        return res.data;
      }
    } catch (e) {
      console.warn('Error al obtener categorías:', e);
    }
    return this._categories();
  }

  /**
   * Cargar alertas de stock crítico desde GET /api/repuestos/alertas-stock
   */
  public async loadAlerts(): Promise<StockAlert[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<{ total_alertas: number; repuestos_criticos: StockAlert[] }>>(this.API_ALERTAS_URL).pipe(
          catchError(err => {
            console.warn('No se pudo conectar a GET /api/repuestos/alertas-stock:', err);
            return of(null);
          })
        )
      );

      if (res && res.success && res.data && Array.isArray(res.data.repuestos_criticos)) {
        this._lowStockAlerts.set(res.data.repuestos_criticos);
        return res.data.repuestos_criticos;
      }
    } catch (e) {
      console.warn('Error al obtener alertas de stock:', e);
    }
    return this._lowStockAlerts();
  }

  /**
   * Cargar historial de movimientos y kardex
   * @param repuestoId Opcional. Si se especifica, carga los de ese repuesto; si no, agrega de todos los repuestos.
   */
  public async loadMovements(repuestoId?: number): Promise<StockMovement[]> {
    try {
      if (repuestoId && repuestoId > 0) {
        // Cargar kardex de un producto específico
        const res = await firstValueFrom(
          this.http.get<ApiResponse<ApiKardexItem[]>>(`${this.API_REPUESTOS_URL}/${repuestoId}/kardex`).pipe(
            catchError(() => of(null))
          )
        );

        if (res && res.success && Array.isArray(res.data)) {
          const item = this._items().find(i => i.numericId === repuestoId);
          const mapped = res.data.map(m => this.mapApiKardexToMovement(m, item?.name || `Repuesto #${repuestoId}`));
          this._movements.set(mapped);
          return mapped;
        }
      } else {
        // Cargar kardex general consultando los repuestos disponibles
        const currentItems = this._items();
        if (currentItems.length === 0) return [];

        // Consultamos en paralelo los kardex de los repuestos
        const itemIds = currentItems
          .map(i => i.numericId)
          .filter((id): id is number => typeof id === 'number' && id > 0);

        const requests = itemIds.map(id =>
          this.http.get<ApiResponse<ApiKardexItem[]>>(`${this.API_REPUESTOS_URL}/${id}/kardex`).pipe(
            catchError(() => of(null))
          )
        );

        const responses = await firstValueFrom(forkJoin(requests));
        const allMovements: StockMovement[] = [];
        const seenIds = new Set<string | number>();

        responses.forEach((res, index) => {
          if (res && res.success && Array.isArray(res.data)) {
            const currentItem = currentItems.find(i => i.numericId === itemIds[index]);
            const itemName = currentItem ? currentItem.name : `Repuesto #${itemIds[index]}`;

            for (const km of res.data) {
              const uniqueKey = `${km.repuesto_id}-${km.id}`;
              if (!seenIds.has(uniqueKey)) {
                seenIds.add(uniqueKey);
                allMovements.push(this.mapApiKardexToMovement(km, itemName));
              }
            }
          }
        });

        // Ordenar descendentemente por fecha_movimiento / id
        allMovements.sort((a, b) => {
          const dateA = new Date(a.date).getTime() || 0;
          const dateB = new Date(b.date).getTime() || 0;
          return dateB - dateA;
        });

        this._movements.set(allMovements);
        return allMovements;
      }
    } catch (e) {
      console.warn('Error al cargar kardex:', e);
    }
    return this._movements();
  }

  /**
   * Registrar nuevo producto en inventario mediante POST /api/repuestos
   */
  public async addItem(itemData: {
    code: string;
    name: string;
    category?: string;
    categoria_id?: number;
    stock: number;
    minStock: number;
    costPrice: number;
    salePrice: number;
    location?: string;
    unit?: string;
    descripcion?: string;
    foto_producto?: string | null;
  }): Promise<InventoryItem> {
    const payload = {
      codigo_sku: itemData.code.trim().toUpperCase(),
      nombre: itemData.name.trim(),
      categoria_id: itemData.categoria_id || undefined,
      categoria: itemData.category || undefined,
      stock_inicial: Number(itemData.stock || 0),
      stock_minimo: Number(itemData.minStock || 4),
      costo_compra: Number(itemData.costPrice || 0),
      precio_venta: Number(itemData.salePrice || 0),
      ubicacion_almacen: itemData.location ? itemData.location.trim() : null,
      unidad_medida: itemData.unit ? itemData.unit.trim() : 'Pieza',
      descripcion: itemData.descripcion ? itemData.descripcion.trim() : null,
      foto_producto: itemData.foto_producto || null
    };

    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<any>>(this.API_REPUESTOS_URL, payload)
      );

      if (res && res.success) {
        // Refrescar listado y categorías desde el servidor
        await this.loadItems();
        await this.loadCategories();
        await this.loadAlerts();
        await this.loadMovements();

        const created = this._items().find(i => i.code === payload.codigo_sku);
        if (created) return created;
      }
    } catch (err: any) {
      console.error('Error al registrar producto en backend:', err);
      throw new Error(err?.error?.message || 'Error al guardar el producto en el servidor.');
    }

    // Fallback local
    const newItem: InventoryItem = {
      id: `INV-${Date.now().toString().slice(-4)}`,
      code: payload.codigo_sku,
      codigo_sku: payload.codigo_sku,
      name: payload.nombre,
      nombre: payload.nombre,
      category: itemData.category || 'General',
      categoria_nombre: itemData.category || 'General',
      stock: payload.stock_inicial,
      stock_actual: payload.stock_inicial,
      minStock: payload.stock_minimo,
      stock_minimo: payload.stock_minimo,
      costPrice: payload.costo_compra,
      costo_compra: payload.costo_compra,
      salePrice: payload.precio_venta,
      precio_venta: payload.precio_venta,
      location: payload.ubicacion_almacen || '',
      ubicacion_almacen: payload.ubicacion_almacen || '',
      unit: payload.unidad_medida,
      unidad_medida: payload.unidad_medida,
      foto_producto: payload.foto_producto,
      lastRestocked: new Date().toISOString().split('T')[0]
    };
    this._items.update(list => [newItem, ...list]);
    return newItem;
  }

  /**
   * Actualizar datos del producto/refacción mediante PUT /api/repuestos/{id}
   */
  public async updateItem(id: number | string, itemData: Partial<InventoryItem>): Promise<boolean> {
    const numericId = typeof id === 'number' ? id : parseInt(id, 10);
    if (!numericId || isNaN(numericId)) {
      // Local fallback
      this._items.update(list => list.map(i => i.id === String(id) ? { ...i, ...itemData } : i));
      return true;
    }

    const payload: any = {};
    if (itemData.name) payload.nombre = itemData.name.trim();
    if (itemData.categoria_id) payload.categoria_id = itemData.categoria_id;
    if (itemData.category) payload.categoria = itemData.category;
    if (itemData.costPrice !== undefined) payload.costo_compra = Number(itemData.costPrice);
    if (itemData.salePrice !== undefined) payload.precio_venta = Number(itemData.salePrice);
    if (itemData.minStock !== undefined) payload.stock_minimo = Number(itemData.minStock);
    if (itemData.location !== undefined) payload.ubicacion_almacen = itemData.location;
    if (itemData.unit !== undefined) payload.unidad_medida = itemData.unit;
    if (itemData.descripcion !== undefined) payload.descripcion = itemData.descripcion;
    if (itemData.foto_producto !== undefined) payload.foto_producto = itemData.foto_producto;

    try {
      const res = await firstValueFrom(
        this.http.put<ApiResponse<any>>(`${this.API_REPUESTOS_URL}/${numericId}`, payload)
      );

      if (res && res.success) {
        await this.loadItems();
        await this.loadAlerts();
        return true;
      }
    } catch (err: any) {
      console.error('Error al actualizar repuesto en backend:', err);
      throw new Error(err?.error?.message || 'Error al actualizar el producto en el servidor.');
    }
    return false;
  }

  /**
   * Registrar movimiento de inventario en backend mediante POST /api/repuestos/{id}/movimiento
   */
  public async recordMovementApi(
    repuestoId: number | string,
    tipo: 'ENTRADA_COMPRA' | 'SALIDA_OT' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' | 'DEVOLUCION',
    cantidad: number,
    motivo: string,
    costoUnitario?: number,
    usuarioId?: number
  ): Promise<boolean> {
    const numericId = typeof repuestoId === 'number' ? repuestoId : parseInt(repuestoId, 10);
    if (!numericId || isNaN(numericId)) {
      console.warn('ID numérico no disponible para registrar movimiento en backend');
      return false;
    }

    const payload = {
      tipo_movimiento: tipo,
      cantidad: Number(cantidad),
      motivo: motivo.trim() || 'Ajuste manual de inventario',
      costo_unitario: costoUnitario !== undefined ? Number(costoUnitario) : undefined,
      usuario_id: usuarioId
    };

    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<any>>(`${this.API_REPUESTOS_URL}/${numericId}/movimiento`, payload)
      );

      if (res && res.success) {
        await this.loadItems();
        await this.loadAlerts();
        await this.loadMovements();
        return true;
      }
    } catch (err: any) {
      console.error('Error al registrar movimiento en backend:', err);
      throw new Error(err?.error?.message || 'Error al registrar el movimiento.');
    }
    return false;
  }

  /**
   * Actualizar stock físico ajustando o mediante compra (compatible con interfaz anterior)
   */
  public async updateStock(itemId: string | number, newStock: number, reason: string, performedBy: string = 'Administrador'): Promise<void> {
    const item = this._items().find(i => String(i.id) === String(itemId) || i.numericId === Number(itemId));
    if (!item) return;

    const diff = Number(newStock) - Number(item.stock);
    if (diff === 0) return;

    const numericId = item.numericId || (typeof itemId === 'number' ? itemId : parseInt(itemId, 10));

    if (numericId && !isNaN(numericId)) {
      const tipo = diff > 0 ? 'ENTRADA_COMPRA' : 'AJUSTE_NEGATIVO';
      try {
        await this.recordMovementApi(
          numericId,
          tipo,
          Math.abs(diff),
          reason || (diff > 0 ? 'Entrada manual / compra' : 'Ajuste por conteo físico'),
          item.costPrice
        );
        return;
      } catch (e) {
        console.warn('Fallo al guardar movimiento en backend, aplicando ajuste local:', e);
      }
    }

    // Fallback local
    this._items.update(list => list.map(i => String(i.id) === String(itemId) ? { ...i, stock: newStock } : i));
    const now = new Date();
    const newMovement: StockMovement = {
      id: `MOV-${Date.now().toString().slice(-4)}`,
      itemId: String(itemId),
      repuesto_id: numericId || undefined,
      itemName: item.name,
      type: diff > 0 ? 'entrada' : 'ajuste',
      quantity: Math.abs(diff),
      date: now.toISOString().replace('T', ' ').slice(0, 16),
      reason,
      performedBy
    };
    this._movements.update(list => [newMovement, ...list]);
  }

  /**
   * Descarga de repuestos vinculados a una Orden de Trabajo
   */
  public deductPartsForWorkOrder(items: WorkOrderItem[], workOrderNumber: string, performedBy: string = 'Sistema'): { success: boolean; messages: string[] } {
    const messages: string[] = [];
    const repuestos = items.filter(i => i.type === 'repuesto');

    if (repuestos.length === 0) {
      return { success: true, messages: ['No hay repuestos físicos que descontar en esta orden.'] };
    }

    this._items.update(currentItems => {
      const updated = [...currentItems];
      for (const item of repuestos) {
        let targetIndex = -1;
        if (item.inventoryItemId) {
          targetIndex = updated.findIndex(inv => String(inv.id) === String(item.inventoryItemId) || String(inv.numericId) === String(item.inventoryItemId));
        }
        if (targetIndex === -1) {
          targetIndex = updated.findIndex(inv =>
            inv.name.toLowerCase().includes(item.description.toLowerCase()) ||
            item.description.toLowerCase().includes(inv.name.toLowerCase())
          );
        }

        if (targetIndex !== -1) {
          const invItem = updated[targetIndex];
          const newQty = Math.max(0, invItem.stock - item.quantity);
          updated[targetIndex] = { ...invItem, stock: newQty };
          messages.push(`Descargado: ${item.quantity}x ${invItem.name}. Stock restante: ${newQty}`);

          const now = new Date();
          const newMovement: StockMovement = {
            id: `MOV-${Date.now().toString().slice(-4)}`,
            itemId: String(invItem.id),
            repuesto_id: invItem.numericId,
            itemName: invItem.name,
            type: 'salida_ot',
            tipo_movimiento: 'SALIDA_OT',
            quantity: item.quantity,
            date: now.toISOString().replace('T', ' ').slice(0, 16),
            workOrderId: workOrderNumber,
            numero_ot: workOrderNumber,
            reason: `Descarga automática por cierre de orden ${workOrderNumber}`,
            performedBy
          };
          this._movements.update(list => [newMovement, ...list]);
        }
      }
      return updated;
    });

    return { success: true, messages };
  }

  // ============================================================================
  // MAPPERS: Transformación de objetos de la API PHP a modelos de TypeScript
  // ============================================================================

  private mapApiToInventoryItem(api: ApiRepuesto): InventoryItem {
    const cost = Number(api.costo_compra) || 0;
    const sale = Number(api.precio_venta) || 0;
    const stock = Number(api.stock_actual) || 0;
    const minStock = Number(api.stock_minimo) || 0;
    const marginUnit = Number(api.margen_bruto_unitario) || (sale - cost);
    const marginPct = Number(api.margen_porcentual) || (sale > 0 ? ((sale - cost) / sale) * 100 : 0);

    return {
      id: String(api.id),
      numericId: api.id,
      code: api.codigo_sku,
      codigo_sku: api.codigo_sku,
      name: api.nombre,
      nombre: api.nombre,
      category: api.categoria_nombre || 'General',
      categoria_nombre: api.categoria_nombre || 'General',
      categoria_id: api.categoria_id || undefined,
      stock,
      stock_actual: stock,
      minStock,
      stock_minimo: minStock,
      costPrice: cost,
      costo_compra: cost,
      salePrice: sale,
      precio_venta: sale,
      location: api.ubicacion_almacen || '',
      ubicacion_almacen: api.ubicacion_almacen || '',
      unit: api.unidad_medida || 'Pieza',
      unidad_medida: api.unidad_medida || 'Pieza',
      foto_producto: api.foto_producto || null,
      descripcion: api.descripcion || null,
      margen_bruto_unitario: marginUnit,
      margen_porcentual: marginPct,
      es_alerta_stock: Boolean(Number(api.es_alerta_stock) === 1 || stock <= minStock),
      created_at: api.created_at || undefined,
      updated_at: api.updated_at || undefined,
      lastRestocked: api.updated_at ? api.updated_at.split(' ')[0] : (api.created_at ? api.created_at.split(' ')[0] : '')
    };
  }

  private mapApiKardexToMovement(km: ApiKardexItem, defaultItemName: string): StockMovement {
    let typeStandard: 'entrada' | 'salida_ot' | 'ajuste' = 'ajuste';
    if (km.tipo_movimiento === 'ENTRADA_COMPRA') {
      typeStandard = 'entrada';
    } else if (km.tipo_movimiento === 'SALIDA_OT') {
      typeStandard = 'salida_ot';
    } else {
      typeStandard = 'ajuste';
    }

    return {
      id: km.id,
      itemId: String(km.repuesto_id),
      repuesto_id: km.repuesto_id,
      itemName: defaultItemName,
      type: typeStandard,
      tipo_movimiento: km.tipo_movimiento,
      quantity: Number(km.cantidad) || 0,
      cantidad: Number(km.cantidad) || 0,
      date: km.fecha_movimiento || '',
      fecha_movimiento: km.fecha_movimiento || '',
      workOrderId: km.numero_ot || (km.orden_trabajo_id ? `OT-${km.orden_trabajo_id}` : undefined),
      numero_ot: km.numero_ot || undefined,
      orden_trabajo_id: km.orden_trabajo_id,
      reason: km.motivo || 'Movimiento de inventario',
      motivo: km.motivo,
      performedBy: km.usuario_nombre || (km.tipo_movimiento === 'SALIDA_OT' ? 'Sistema / OT' : 'Administrador'),
      usuario_nombre: km.usuario_nombre || undefined,
      stock_anterior: Number(km.stock_anterior) || 0,
      stock_posterior: Number(km.stock_posterior) || 0,
      costo_unitario: km.costo_unitario ? Number(km.costo_unitario) : undefined,
      precio_unitario: km.precio_unitario ? Number(km.precio_unitario) : undefined
    };
  }
}
