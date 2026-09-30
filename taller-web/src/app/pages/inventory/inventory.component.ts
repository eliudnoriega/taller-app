import { Component, inject, signal, viewChild, ElementRef, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../core/services/inventory.service';
import { WorkOrderService } from '../../core/services/work-order.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { InventoryItem, StockMovement } from '../../core/models/inventory.model';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit, OnDestroy {
  public inventoryService = inject(InventoryService);
  public workOrderService = inject(WorkOrderService);

  // Tabs and filters
  activeTab = signal<'stock' | 'movimientos'>('stock');
  searchTerm = signal<string>('');
  selectedCategory = signal<string>('todas');
  onlyLowStock = signal<boolean>(false);
  selectedKardexRepuestoId = signal<number>(0);
  isSyncing = signal<boolean>(false);

  // Modals state
  isCreateModalOpen = signal(false);
  isEditModalOpen = signal(false);
  isAdjustModalOpen = signal(false);
  isPhotoPreviewModalOpen = signal(false);
  previewPhotoUrl = signal<string | null>(null);
  previewPhotoTitle = signal<string>('');

  // Toast
  toastMessage = signal<string | null>(null);

  // Camera state
  isCameraModalOpen = signal(false);
  isCameraLoading = signal(false);
  cameraError = signal<string | null>(null);
  capturedImage = signal<string | null>(null);
  cameraTarget = signal<'new' | 'edit'>('new');
  facingMode = signal<'user' | 'environment'>('environment');
  private mediaStream: MediaStream | null = null;

  videoElementRef = viewChild<ElementRef<HTMLVideoElement>>('videoElement');
  canvasElementRef = viewChild<ElementRef<HTMLCanvasElement>>('canvasElement');

  // New Item Model
  newItem = {
    code: '',
    name: '',
    category: 'Frenos y Seguridad',
    categoria_id: 1,
    nueva_categoria: '',
    stock: 10,
    minStock: 4,
    costPrice: 150,
    salePrice: 320,
    location: 'Estante A-01',
    unit: 'Pieza',
    descripcion: '',
    foto_producto: '' as string | null
  };

  // Edit Item Model
  editItem = {
    id: 0,
    code: '',
    name: '',
    category: '',
    categoria_id: 0,
    stock: 0,
    minStock: 4,
    costPrice: 0,
    salePrice: 0,
    location: '',
    unit: 'Pieza',
    descripcion: '',
    foto_producto: '' as string | null
  };

  // Adjust Model
  adjustModel = {
    itemId: 0 as number | string,
    itemName: '',
    itemCode: '',
    currentStock: 0,
    unit: 'Pieza',
    tipo_movimiento: 'ENTRADA_COMPRA' as 'ENTRADA_COMPRA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' | 'DEVOLUCION',
    cantidad: 5,
    costo_unitario: 0,
    motivo: 'Compra de repuesto para stock'
  };

  // Categories list for filter bar and dropdowns
  categories = computed(() => {
    const fromApi = this.inventoryService.categories().map(c => c.nombre);
    if (fromApi.length > 0) {
      return ['todas', ...fromApi];
    }
    return ['todas', 'Frenos y Seguridad', 'Motor y Afinación', 'Suspensión y Dirección', 'Fluidos y Lubricantes', 'Aceites y Fluidos Sintéticos', 'Insumos'];
  });

  ngOnInit(): void {
    this.inventoryService.loadAll();
  }

  ngOnDestroy(): void {
    this.stopCameraStream();
  }

  // Filtered inventory items for the table
  get filteredItems(): InventoryItem[] {
    const list = this.inventoryService.items();
    const query = this.searchTerm().trim().toLowerCase();
    const cat = this.selectedCategory();
    const lowOnly = this.onlyLowStock();

    return list.filter(item => {
      const matchCat = cat === 'todas' || item.category === cat || item.categoria_nombre === cat;
      const matchLow = !lowOnly || item.stock <= item.minStock || Boolean(item.es_alerta_stock);
      const matchQuery = !query ||
        item.name.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query) ||
        (item.location && item.location.toLowerCase().includes(query)) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(query));
      return matchCat && matchLow && matchQuery;
    });
  }

  // Filtered movements for the Kardex tab
  get filteredMovements(): StockMovement[] {
    const repId = this.selectedKardexRepuestoId();
    const all = this.inventoryService.movements();
    if (!repId || repId === 0) {
      return all;
    }
    return all.filter(m => m.repuesto_id === repId || String(m.itemId) === String(repId));
  }

  async syncData(): Promise<void> {
    this.isSyncing.set(true);
    try {
      await this.inventoryService.loadAll();
      this.showToast('✓ Inventario sincronizado exitosamente con el servidor');
    } catch (e) {
      this.showToast('Error al sincronizar inventario');
    } finally {
      this.isSyncing.set(false);
    }
  }

  onKardexRepuestoChange(repuestoId: number): void {
    this.selectedKardexRepuestoId.set(Number(repuestoId));
    if (repuestoId > 0) {
      this.inventoryService.loadMovements(Number(repuestoId));
    } else {
      this.inventoryService.loadMovements();
    }
  }

  // =========================================================================
  // MODAL: CREATE ITEM
  // =========================================================================
  openCreateModal(): void {
    const cats = this.inventoryService.categories();
    const defaultCat = cats.length > 0 ? cats[0].nombre : 'Frenos y Seguridad';
    const defaultCatId = cats.length > 0 ? cats[0].id : 1;

    this.newItem = {
      code: `REP-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      category: defaultCat,
      categoria_id: defaultCatId,
      nueva_categoria: '',
      stock: 10,
      minStock: 4,
      costPrice: 150,
      salePrice: 320,
      location: 'Estante A-01',
      unit: 'Pieza',
      descripcion: '',
      foto_producto: null
    };
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  async saveNewItem(): Promise<void> {
    if (!this.newItem.name || !this.newItem.code) {
      alert('Por favor ingrese Código SKU y Nombre del repuesto.');
      return;
    }

    const catName = this.newItem.nueva_categoria.trim() || this.newItem.category;

    try {
      await this.inventoryService.addItem({
        code: this.newItem.code.trim().toUpperCase(),
        name: this.newItem.name.trim(),
        category: catName,
        categoria_id: this.newItem.categoria_id || undefined,
        stock: Number(this.newItem.stock || 0),
        minStock: Number(this.newItem.minStock || 4),
        costPrice: Number(this.newItem.costPrice || 0),
        salePrice: Number(this.newItem.salePrice || 0),
        location: this.newItem.location.trim(),
        unit: this.newItem.unit.trim(),
        descripcion: this.newItem.descripcion.trim(),
        foto_producto: this.newItem.foto_producto
      });

      this.closeCreateModal();
      this.showToast(`✓ Producto "${this.newItem.name}" registrado en inventario`);
    } catch (err: any) {
      alert(err?.message || 'Error al guardar el nuevo repuesto.');
    }
  }

  // =========================================================================
  // MODAL: EDIT ITEM
  // =========================================================================
  openEditModal(item: InventoryItem): void {
    this.editItem = {
      id: item.numericId || parseInt(item.id, 10) || 0,
      code: item.code,
      name: item.name,
      category: item.category || item.categoria_nombre || '',
      categoria_id: item.categoria_id || 0,
      stock: item.stock,
      minStock: item.minStock,
      costPrice: item.costPrice,
      salePrice: item.salePrice,
      location: item.location || item.ubicacion_almacen || '',
      unit: item.unit || item.unidad_medida || 'Pieza',
      descripcion: item.descripcion || '',
      foto_producto: item.foto_producto || null
    };
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
  }

  async saveEditItem(): Promise<void> {
    if (!this.editItem.name) {
      alert('El nombre del repuesto es obligatorio.');
      return;
    }

    try {
      await this.inventoryService.updateItem(this.editItem.id, {
        name: this.editItem.name.trim(),
        category: this.editItem.category,
        categoria_id: this.editItem.categoria_id || undefined,
        costPrice: Number(this.editItem.costPrice || 0),
        salePrice: Number(this.editItem.salePrice || 0),
        minStock: Number(this.editItem.minStock || 4),
        location: this.editItem.location.trim(),
        unit: this.editItem.unit.trim(),
        descripcion: this.editItem.descripcion.trim(),
        foto_producto: this.editItem.foto_producto
      });

      this.closeEditModal();
      this.showToast(`✓ Cambios guardados para "${this.editItem.name}"`);
    } catch (err: any) {
      alert(err?.message || 'Error al actualizar el producto.');
    }
  }

  // =========================================================================
  // MODAL: ADJUST STOCK / ENTRADAS / SALIDAS
  // =========================================================================
  openAdjustModal(item: InventoryItem): void {
    this.adjustModel = {
      itemId: item.numericId || item.id,
      itemName: item.name,
      itemCode: item.code,
      currentStock: item.stock,
      unit: item.unit || item.unidad_medida || 'Pieza',
      tipo_movimiento: 'ENTRADA_COMPRA',
      cantidad: 5,
      costo_unitario: item.costPrice,
      motivo: 'Compra de reposición a distribuidor'
    };
    this.isAdjustModalOpen.set(true);
  }

  closeAdjustModal(): void {
    this.isAdjustModalOpen.set(false);
  }

  async saveAdjust(): Promise<void> {
    if (this.adjustModel.cantidad <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    try {
      await this.inventoryService.recordMovementApi(
        this.adjustModel.itemId,
        this.adjustModel.tipo_movimiento,
        this.adjustModel.cantidad,
        this.adjustModel.motivo,
        this.adjustModel.costo_unitario
      );

      this.closeAdjustModal();
      this.showToast(`✓ Movimiento registrado para ${this.adjustModel.itemName}`);
    } catch (err: any) {
      alert(err?.message || 'Error al registrar el movimiento.');
    }
  }

  // =========================================================================
  // PHOTO PREVIEW LIGHTBOX
  // =========================================================================
  openPhotoPreview(photoUrl: string | null | undefined, title: string): void {
    if (!photoUrl) return;
    this.previewPhotoUrl.set(photoUrl);
    this.previewPhotoTitle.set(title);
    this.isPhotoPreviewModalOpen.set(true);
  }

  closePhotoPreview(): void {
    this.isPhotoPreviewModalOpen.set(false);
    this.previewPhotoUrl.set(null);
  }

  // =========================================================================
  // FILE UPLOAD (BASE64)
  // =========================================================================
  private compressImage(file: File, maxWidth: number = 800, quality: number = 0.85): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', quality);
            resolve(compressed);
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error('Error al decodificar la imagen'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  }

  async onFileSelected(event: Event, target: 'new' | 'edit'): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Por favor seleccione un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }

    try {
      const base64 = await this.compressImage(file, 800, 0.85);
      if (target === 'new') {
        this.newItem.foto_producto = base64;
      } else {
        this.editItem.foto_producto = base64;
      }
      this.showToast('✓ Imagen optimizada y cargada en Base64');
    } catch (e) {
      alert('Error al procesar la imagen seleccionada.');
    } finally {
      input.value = '';
    }
  }

  removePhoto(target: 'new' | 'edit'): void {
    if (target === 'new') {
      this.newItem.foto_producto = null;
    } else {
      this.editItem.foto_producto = null;
    }
  }

  // =========================================================================
  // WEBCAM CAMERA MODAL
  // =========================================================================
  openCameraModal(target: 'new' | 'edit'): void {
    this.cameraTarget.set(target);
    this.capturedImage.set(null);
    this.cameraError.set(null);
    this.isCameraModalOpen.set(true);
    this.startCameraStream();
  }

  closeCameraModal(): void {
    this.stopCameraStream();
    this.isCameraModalOpen.set(false);
    this.capturedImage.set(null);
    this.cameraError.set(null);
  }

  async startCameraStream(): Promise<void> {
    this.isCameraLoading.set(true);
    this.cameraError.set(null);
    this.stopCameraStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.cameraError.set('Tu navegador o dispositivo no soporta acceso directo a la cámara. Puedes subir una imagen desde tus archivos.');
      this.isCameraLoading.set(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.facingMode(),
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      this.mediaStream = stream;
      this.isCameraLoading.set(false);

      setTimeout(() => {
        const videoEl = this.videoElementRef();
        if (videoEl && videoEl.nativeElement) {
          videoEl.nativeElement.srcObject = stream;
          videoEl.nativeElement.play().catch(e => {
            console.warn('AutoPlay de cámara prevenido:', e);
          });
        }
      }, 100);
    } catch (err: any) {
      this.isCameraLoading.set(false);
      let errorMsg = 'No se pudo acceder a la cámara. Asegúrate de otorgar los permisos.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Permiso denegado: Por favor habilita el permiso de cámara en tu navegador.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No se encontró ninguna cámara conectada en este equipo.';
      }
      this.cameraError.set(errorMsg);
    }
  }

  stopCameraStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    const videoEl = this.videoElementRef();
    if (videoEl && videoEl.nativeElement) {
      videoEl.nativeElement.srcObject = null;
    }
  }

  switchCamera(): void {
    this.facingMode.set(this.facingMode() === 'user' ? 'environment' : 'user');
    if (!this.capturedImage()) {
      this.startCameraStream();
    }
  }

  takePhoto(): void {
    const videoEl = this.videoElementRef();
    const video = videoEl?.nativeElement;

    if (!video || !video.videoWidth || !video.videoHeight) {
      this.cameraError.set('Espere a que la transmisión de video esté activa para capturar.');
      return;
    }

    const canvasEl = this.canvasElementRef();
    const canvas = canvasEl?.nativeElement || document.createElement('canvas');

    let targetWidth = video.videoWidth;
    let targetHeight = video.videoHeight;
    const maxDim = 800;

    if (targetWidth > maxDim || targetHeight > maxDim) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
        targetWidth = maxDim;
      } else {
        targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
        targetHeight = maxDim;
      }
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      this.capturedImage.set(dataUrl);
      this.stopCameraStream();
    }
  }

  retakePhoto(): void {
    this.capturedImage.set(null);
    this.startCameraStream();
  }

  acceptPhoto(): void {
    const photo = this.capturedImage();
    if (!photo) return;

    if (this.cameraTarget() === 'new') {
      this.newItem.foto_producto = photo;
    } else {
      this.editItem.foto_producto = photo;
    }

    this.showToast('✓ Foto capturada y aplicada al producto en Base64');
    this.closeCameraModal();
  }

  calculateMargin(cost: number, sale: number): number {
    if (sale === 0) return 0;
    return Math.round(((sale - cost) / sale) * 100);
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
