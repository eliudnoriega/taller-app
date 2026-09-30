import { Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { WorkOrderService } from '../../core/services/work-order.service';
import { InventoryService } from '../../core/services/inventory.service';
import { NotificationService } from '../../core/services/notification.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { WorkOrder, WorkOrderStatus, PriorityLevel, InspectionChecklist, WorkOrderItem, OrderStatusComment } from '../../core/models/work-order.model';
import { RegisteredVehicle } from '../../core/models/client-vehicle.model';

@Component({
  selector: 'app-work-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './work-orders.component.html',
  styleUrl: './work-orders.component.css'
})
export class WorkOrdersComponent implements OnInit, OnDestroy {
  public workOrderService = inject(WorkOrderService);
  public inventoryService = inject(InventoryService);
  public notifService = inject(NotificationService);
  private route = inject(ActivatedRoute);

  // Filters & State
  selectedStatusFilter = signal<string>('todos');
  searchTerm = signal<string>('');
  selectedOrder = signal<WorkOrder | null>(null);
  isCreateModalOpen = signal(false);
  toastMessage = signal<string | null>(null);

  // Control de Placa y Vehículo
  isExistingVehicle = signal<boolean>(false);
  isPlateDropdownOpen = signal<boolean>(false);

  // Control de Cámara / Captura de Evidencias Fotográficas
  isCameraModalOpen = signal<boolean>(false);
  cameraError = signal<string | null>(null);
  capturedImage = signal<string | null>(null);
  isCameraLoading = signal<boolean>(false);
  facingMode = signal<'environment' | 'user'>('environment');
  cameraTarget = signal<'newOrder' | 'selectedOrder'>('newOrder');
  private mediaStream: MediaStream | null = null;

  @ViewChild('videoElement') videoElementRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElementRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInputRef') fileInputRef?: ElementRef<HTMLInputElement>;

  // Status mapping
  statusList: { key: WorkOrderStatus; label: string; class: string; icon: string }[] = [
    { key: 'diagnostico', label: 'En Diagnóstico', class: 'badge-diagnostico', icon: 'wrench' },
    { key: 'esperando_repuestos', label: 'Esperando Repuestos', class: 'badge-esperando_repuestos', icon: 'package' },
    { key: 'en_reparacion', label: 'En Reparación', class: 'badge-en_reparacion', icon: 'wrench' },
    { key: 'listo_entrega', label: 'Listo para Entrega', class: 'badge-listo_entrega', icon: 'check-circle' },
    { key: 'entregado', label: 'Entregado', class: 'badge-entregado', icon: 'check' }
  ];

  // Bitácora y Comentarios por Estado en Orden Existente
  selectedCommentStatus: WorkOrderStatus = 'diagnostico';
  newCommentText: string = '';
  newCommentAuthor: string = 'Técnico MELECSA';

  // Agregar Servicios y Repuestos en Orden Existente (Modal Detalle)
  detailNewItemType: 'repuesto' | 'mano_de_obra' = 'repuesto';
  detailNewItemDesc: string = '';
  detailNewItemQty: number = 1;
  detailNewItemPrice: number = 350;
  detailSelectedInventoryItem: string = '';

  // New Order Form state
  newOrder = {
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    vehiclePlate: '',
    vehicleDescription: '',
    vehicleMileage: 45000,
    estimatedDeliveryDate: '',
    priority: 'media' as PriorityLevel,
    mechanicId: 'MEC-01',
    failureDescription: '',
    advancePaid: 0,
    checklist: {
      fuelLevel: 50 as (0 | 25 | 50 | 75 | 100),
      bodyNotes: 'Sin golpes visibles. Raspón leve en parte baja.',
      spareTire: true,
      hydraulicJack: true,
      wheelWrench: true,
      vehicleDocuments: true,
      cleanExterior: true,
      batteryWorking: true,
      airConditioning: true,
      lightsWorking: true,
      photos: [
        'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&q=80&w=600'
      ]
    },
    items: [
      {
        id: 'ITEM-TEMP-1',
        type: 'mano_de_obra' as ('repuesto' | 'mano_de_obra'),
        description: 'Diagnóstico general computarizado y revisión integral',
        quantity: 1,
        unitPrice: 650,
        total: 650
      }
    ] as WorkOrderItem[]
  };

  newItemDesc = '';
  newItemType: 'repuesto' | 'mano_de_obra' = 'repuesto';
  newItemPrice = 350;
  newItemQty = 1;
  selectedInventoryItem = '';

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['nueva'] === 'true') {
        this.openCreateModal();
      }
    });
  }

  get matchingRegisteredVehicles(): RegisteredVehicle[] {
    const query = (this.newOrder.vehiclePlate || '').trim().toUpperCase();
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
    this.newOrder.vehiclePlate = cleanPlate;

    const found = this.workOrderService.findVehicleByPlate(cleanPlate);
    if (found) {
      this.isExistingVehicle.set(true);
      this.newOrder.vehicleDescription = found.description;
      if (!this.newOrder.clientName) {
        this.newOrder.clientName = found.clientName;
      }
      if (!this.newOrder.clientPhone && found.clientPhone) {
        this.newOrder.clientPhone = found.clientPhone;
      }
      if (!this.newOrder.clientEmail && found.clientEmail) {
        this.newOrder.clientEmail = found.clientEmail;
      }
      if (found.mileage) {
        this.newOrder.vehicleMileage = found.mileage;
      }
    } else {
      this.isExistingVehicle.set(false);
    }
  }

  selectExistingVehicle(vehicle: RegisteredVehicle): void {
    this.newOrder.vehiclePlate = vehicle.plate;
    this.newOrder.vehicleDescription = vehicle.description;
    this.newOrder.clientName = vehicle.clientName;
    this.newOrder.clientPhone = vehicle.clientPhone || '';
    this.newOrder.clientEmail = vehicle.clientEmail || '';
    if (vehicle.mileage) {
      this.newOrder.vehicleMileage = vehicle.mileage;
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

  get filteredOrders(): WorkOrder[] {
    const list = this.workOrderService.orders();
    const status = this.selectedStatusFilter();
    const query = this.searchTerm().trim().toLowerCase();

    return list.filter(order => {
      const matchStatus = status === 'todos' || order.status === status;
      const matchQuery = !query || 
        order.orderNumber.toLowerCase().includes(query) ||
        order.vehiclePlate.toLowerCase().includes(query) ||
        order.clientName.toLowerCase().includes(query) ||
        order.vehicleDescription.toLowerCase().includes(query);
      return matchStatus && matchQuery;
    });
  }

  openCreateModal(): void {
    this.newOrder = {
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      vehiclePlate: '',
      vehicleDescription: '',
      vehicleMileage: 45000,
      estimatedDeliveryDate: '',
      priority: 'media',
      mechanicId: 'MEC-01',
      failureDescription: '',
      advancePaid: 0,
      checklist: {
        fuelLevel: 50,
        bodyNotes: 'Sin golpes visibles. Raspón leve en parte baja.',
        spareTire: true,
        hydraulicJack: true,
        wheelWrench: true,
        vehicleDocuments: true,
        cleanExterior: true,
        batteryWorking: true,
        airConditioning: true,
        lightsWorking: true,
        photos: [
          'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=600',
          'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&q=80&w=600'
        ]
      },
      items: [
        {
          id: 'ITEM-TEMP-1',
          type: 'mano_de_obra',
          description: 'Diagnóstico general computarizado y revisión integral',
          quantity: 1,
          unitPrice: 650,
          total: 650
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

  setFuelLevel(level: 0 | 25 | 50 | 75 | 100): void {
    this.newOrder.checklist.fuelLevel = level;
  }

  addPhotoPlaceholder(): void {
    this.openCameraModal('newOrder');
  }

  openCameraModal(target: 'newOrder' | 'selectedOrder' = 'newOrder'): void {
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
      this.attachStreamToVideo(stream);
    } catch (err: any) {
      console.warn('Fallo al solicitar cámara con facingMode específico, intentando modo genérico...', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        this.mediaStream = fallbackStream;
        this.isCameraLoading.set(false);
        this.attachStreamToVideo(fallbackStream);
      } catch (fallbackErr: any) {
        this.isCameraLoading.set(false);
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          this.cameraError.set('Permiso denegado. Por favor permite el acceso a la cámara en los permisos de tu navegador para tomar fotos en vivo.');
        } else {
          this.cameraError.set('No se detectó una cámara activa en este equipo. Puedes seleccionar una foto de tu galería o archivos.');
        }
      }
    }
  }

  private attachStreamToVideo(stream: MediaStream): void {
    setTimeout(() => {
      if (this.videoElementRef?.nativeElement) {
        const video = this.videoElementRef.nativeElement;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        video.play().catch(e => console.log('Video play error:', e));
      }
    }, 100);
  }

  switchCamera(): void {
    this.facingMode.update(m => m === 'environment' ? 'user' : 'environment');
    this.startCameraStream();
  }

  takePhoto(): void {
    const video = this.videoElementRef?.nativeElement;
    if (!video || !video.videoWidth) {
      this.cameraError.set('Espere a que el video de la cámara esté activo para capturar.');
      return;
    }

    const canvas = this.canvasElementRef?.nativeElement || document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      this.capturedImage.set(dataUrl);
    }
  }

  retakePhoto(): void {
    this.capturedImage.set(null);
    if (this.mediaStream && this.videoElementRef?.nativeElement) {
      const video = this.videoElementRef.nativeElement;
      video.srcObject = this.mediaStream;
      video.play().catch(e => console.log('Video play error:', e));
    } else {
      this.startCameraStream();
    }
  }

  acceptPhoto(keepOpen: boolean = false): void {
    const photo = this.capturedImage();
    if (!photo) return;

    if (this.cameraTarget() === 'newOrder') {
      this.newOrder.checklist.photos.push(photo);
      this.showToast('✓ Fotografía de evidencia añadida a la recepción');
    } else {
      const order = this.selectedOrder();
      if (order) {
        order.checklist.photos.push(photo);
        this.showToast('✓ Fotografía añadida al checklist de la orden');
      }
    }

    if (keepOpen) {
      this.capturedImage.set(null);
      this.retakePhoto();
    } else {
      this.closeCameraModal();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          this.capturedImage.set(result);
          this.cameraError.set(null);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  stopCameraStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElementRef?.nativeElement) {
      this.videoElementRef.nativeElement.srcObject = null;
    }
  }

  removePhoto(index: number): void {
    this.newOrder.checklist.photos.splice(index, 1);
  }

  ngOnDestroy(): void {
    this.stopCameraStream();
  }

  addItemToNewOrder(): void {
    if (!this.newItemDesc) return;
    const item: WorkOrderItem = {
      id: `ITM-${Date.now()}`,
      type: this.newItemType,
      description: this.newItemDesc,
      quantity: this.newItemQty,
      unitPrice: this.newItemPrice,
      total: this.newItemPrice * this.newItemQty
    };
    this.newOrder.items.push(item);
    this.newItemDesc = '';
    this.newItemQty = 1;
    this.newItemPrice = 350;
  }

  removeItemFromNewOrder(index: number): void {
    this.newOrder.items.splice(index, 1);
  }

  calculateOrderSubtotal(): number {
    return this.newOrder.items.reduce((sum, item) => sum + item.total, 0);
  }

  saveNewOrder(): void {
    if (!this.newOrder.clientName || !this.newOrder.vehiclePlate) {
      alert('Por favor ingrese el nombre del cliente y la placa del vehículo.');
      return;
    }

    const assignedMec = this.workOrderService.mechanics.find(m => m.id === this.newOrder.mechanicId);

    const created = this.workOrderService.addOrder({
      clientName: this.newOrder.clientName,
      clientPhone: this.newOrder.clientPhone || '+52 55 1234 5678',
      clientEmail: this.newOrder.clientEmail || 'cliente@ejemplo.com',
      vehiclePlate: this.newOrder.vehiclePlate.toUpperCase(),
      vehicleDescription: this.newOrder.vehicleDescription || 'Vehículo General',
      vehicleMileage: this.newOrder.vehicleMileage,
      estimatedDeliveryDate: this.newOrder.estimatedDeliveryDate || '2026-09-30 18:00',
      priority: this.newOrder.priority,
      mechanicId: this.newOrder.mechanicId,
      mechanicName: assignedMec ? assignedMec.name : 'Roberto Valdés',
      failureDescription: this.newOrder.failureDescription || 'Revisión y mantenimiento solicitado por cliente',
      checklist: { ...this.newOrder.checklist },
      items: [...this.newOrder.items],
      advancePaid: this.newOrder.advancePaid
    });

    this.closeCreateModal();
    this.showToast(`¡Orden de Trabajo ${created.orderNumber} creada con checklist completo!`);
    this.selectedOrder.set(created);
  }

  viewOrderDetail(order: WorkOrder): void {
    this.selectedOrder.set(order);
    this.selectedCommentStatus = order.status;
    this.newCommentText = '';
    this.detailNewItemDesc = '';
    this.detailNewItemQty = 1;
    this.detailNewItemPrice = 350;
    this.detailSelectedInventoryItem = '';
  }

  closeDetailModal(): void {
    this.selectedOrder.set(null);
  }

  changeOrderStatus(orderId: string, status: WorkOrderStatus): void {
    this.workOrderService.updateOrderStatus(orderId, status);
    const updated = this.workOrderService.getOrderById(orderId);
    if (updated) {
      this.selectedOrder.set(updated);
      this.selectedCommentStatus = status;
    }
    this.showToast(`Estado de la orden actualizado a: ${this.getStatusLabel(status)}`);
  }

  addCommentToSelectedOrder(): void {
    const order = this.selectedOrder();
    if (!order || !this.newCommentText.trim()) return;

    this.workOrderService.addStatusComment(
      order.id,
      this.newCommentText,
      this.selectedCommentStatus,
      this.newCommentAuthor || 'Técnico MELECSA'
    );

    const updated = this.workOrderService.getOrderById(order.id);
    if (updated) {
      this.selectedOrder.set(updated);
    }

    this.newCommentText = '';
    this.showToast(`Comentario registrado para: ${this.getStatusLabel(this.selectedCommentStatus)}`);
  }

  onSelectInventoryForDetail(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const invId = target.value;
    if (!invId) return;

    const item = this.inventoryService.items().find(i => i.id === invId);
    if (item) {
      this.detailNewItemDesc = `${item.name} (${item.code})`;
      this.detailNewItemPrice = item.salePrice;
      this.detailNewItemType = 'repuesto';
    }
  }

  addItemToSelectedOrder(): void {
    const order = this.selectedOrder();
    if (!order) return;

    if (!this.detailNewItemDesc.trim()) {
      alert('Por favor ingrese la descripción del servicio o repuesto.');
      return;
    }

    const updated = this.workOrderService.addItemToOrder(order.id, {
      type: this.detailNewItemType,
      description: this.detailNewItemDesc.trim(),
      quantity: this.detailNewItemQty,
      unitPrice: this.detailNewItemPrice,
      inventoryItemId: this.detailSelectedInventoryItem || undefined
    });

    if (updated) {
      this.selectedOrder.set(updated);
      this.detailNewItemDesc = '';
      this.detailNewItemQty = 1;
      this.detailNewItemPrice = 350;
      this.detailSelectedInventoryItem = '';
      this.showToast('¡Servicio / Repuesto agregado y totales recalculados automáticamente!');
    }
  }

  removeItemFromSelectedOrder(itemId: string): void {
    const order = this.selectedOrder();
    if (!order) return;

    const updated = this.workOrderService.removeItemFromOrder(order.id, itemId);
    if (updated) {
      this.selectedOrder.set(updated);
      this.showToast('Concepto eliminado y saldos de la orden actualizados');
    }
  }

  getStatusLabel(status: WorkOrderStatus): string {
    const found = this.statusList.find(s => s.key === status);
    return found ? found.label : status;
  }

  getStatusBadgeClass(status: WorkOrderStatus): string {
    const found = this.statusList.find(s => s.key === status);
    return found ? found.class : 'badge-diagnostico';
  }

  getStatusIcon(status: WorkOrderStatus): string {
    const found = this.statusList.find(s => s.key === status);
    return found ? found.icon : 'wrench';
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

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3500);
  }
}
