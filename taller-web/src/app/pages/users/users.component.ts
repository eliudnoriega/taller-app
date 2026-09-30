import { Component, inject, signal, computed, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, SystemUser } from '../../core/services/user.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css'
})
export class UsersComponent implements OnDestroy {
  public userService = inject(UserService);

  searchTerm = signal<string>('');
  selectedRoleFilter = signal<string>('todos');
  selectedStatusFilter = signal<string>('todos');
  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  toastMessage = signal<string | null>(null);

  // Camera Dialog State
  isCameraModalOpen = signal<boolean>(false);
  isCameraLoading = signal<boolean>(false);
  cameraError = signal<string | null>(null);
  capturedImage = signal<string | null>(null);
  facingMode = signal<'user' | 'environment'>('user');
  private mediaStream: MediaStream | null = null;

  // Template Element References
  videoElementRef = viewChild<ElementRef<HTMLVideoElement>>('videoElement');
  canvasElementRef = viewChild<ElementRef<HTMLCanvasElement>>('canvasElement');
  fileUploadInputRef = viewChild<ElementRef<HTMLInputElement>>('fileUploadInput');

  // Form State
  formUser: Partial<SystemUser> & { initialPassword?: string } = {
    name: '',
    email: '',
    role: 'asesor',
    roleLabel: 'Asesor de Recepción',
    especialidad: '',
    phone: '',
    status: 'activo',
    initialPassword: '',
    avatar: ''
  };

  rolesList: { key: 'admin' | 'asesor' | 'mecanico' | 'cajero'; label: string; desc: string }[] = [
    { key: 'admin', label: 'Administrador General', desc: 'Acceso total al sistema, reportes y configuración' },
    { key: 'asesor', label: 'Asesor de Recepción', desc: 'Recepción, checklists, órdenes de trabajo y clientes' },
    { key: 'mecanico', label: 'Mecánico de Taller', desc: 'Diagnóstico, solicitud de repuestos y bitácora técnica' },
    { key: 'cajero', label: 'Cajero / Cobranza', desc: 'Caja diaria, anticipos, facturación y arqueos' }
  ];

  filteredUsers = computed(() => {
    const list = this.userService.users();
    const query = this.searchTerm().trim().toLowerCase();
    const role = this.selectedRoleFilter();
    const status = this.selectedStatusFilter();

    return list.filter(u => {
      const matchRole = role === 'todos' || u.role === role;
      const matchStatus = status === 'todos' || u.status === status;
      const matchQuery = !query ||
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        (u.phone && u.phone.toLowerCase().includes(query)) ||
        u.roleLabel.toLowerCase().includes(query) ||
        u.especialidad.toLowerCase().includes(query);

      return matchRole && matchStatus && matchQuery;
    });
  });

  ngOnDestroy(): void {
    this.stopCameraStream();
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.formUser = {
      name: '',
      email: '',
      role: 'asesor',
      roleLabel: 'Asesor de Recepción',
      especialidad: 'Atención al Cliente y Checklist',
      phone: '',
      status: 'activo',
      initialPassword: 'Password123!',
      avatar: ''
    };
    this.isModalOpen.set(true);
  }

  async openEditModal(user: SystemUser): Promise<void> {
    this.isEditing.set(true);
    this.formUser = { ...user, initialPassword: '' };
    this.isModalOpen.set(true);

    // Consultar detalle fresco desde el backend para garantizar que el Base64 de foto_perfil esté al día
    try {
      const freshUser = await this.userService.getUserDetail(user.id);
      if (freshUser && freshUser.avatar) {
        this.formUser.avatar = freshUser.avatar;
      }
    } catch (e) {
      console.warn('Error refrescando detalle de usuario al editar:', e);
    }
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.closeCameraModal();
  }

  onRoleChange(roleKey: 'admin' | 'asesor' | 'mecanico' | 'cajero'): void {
    const found = this.rolesList.find(r => r.key === roleKey);
    if (found) {
      this.formUser.role = roleKey;
      this.formUser.roleLabel = found.label;
    }
  }

  async saveUser(): Promise<void> {
    if (!this.formUser.name?.trim() || !this.formUser.email?.trim()) {
      alert('Por favor ingrese el nombre y el correo electrónico del usuario.');
      return;
    }

    this.isSaving.set(true);

    try {
      if (this.isEditing() && this.formUser.id) {
        await this.userService.updateUser(
          this.formUser.id,
          this.formUser,
          this.formUser.initialPassword
        );
        this.showToast(`✓ Usuario ${this.formUser.name} actualizado exitosamente`);
      } else {
        const created = await this.userService.addUser(
          this.formUser,
          this.formUser.initialPassword
        );
        this.showToast(`✓ Usuario ${created.name} creado exitosamente con credencial (${created.email})`);
      }
      this.closeModal();
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Error al comunicarse con el servidor';
      alert('Error al guardar el usuario en el servidor: ' + msg);
    } finally {
      this.isSaving.set(false);
    }
  }

  async toggleStatus(user: SystemUser): Promise<void> {
    await this.userService.toggleStatus(user.id);
    const next = user.status === 'activo' ? 'inactivo' : 'activo';
    this.showToast(`Estatus del usuario ${user.name} cambiado a: ${next.toUpperCase()}`);
  }

  async deleteUser(user: SystemUser): Promise<void> {
    if (user.role === 'admin' && this.userService.adminUsersCount() <= 1) {
      alert('No se puede eliminar el único Administrador del sistema.');
      return;
    }

    if (confirm(`¿Confirma eliminar o desactivar al usuario ${user.name} (${user.email})? Esta acción revocará su acceso al sistema MELECSA.`)) {
      await this.userService.deleteUser(user.id);
      this.showToast(`Usuario ${user.name} removido del sistema`);
    }
  }

  resetPassword(user: SystemUser): void {
    if (confirm(`¿Desea enviar un enlace de restablecimiento de contraseña a ${user.email}?`)) {
      this.showToast(`Enlace de restablecimiento enviado a ${user.email}`);
    }
  }

  refreshList(): void {
    this.userService.loadUsers();
    this.showToast('Actualizando usuarios desde el servidor...');
  }

  // ==============================================================================
  // GESTIÓN DE ARCHIVOS Y CONVERSIÓN A BASE64
  // ==============================================================================

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      if (!file.type.startsWith('image/')) {
        alert('Por favor seleccione un archivo de imagen válido (JPG, PNG, WebP).');
        return;
      }

      try {
        const base64 = await this.compressFileToBase64(file);
        if (this.isCameraModalOpen()) {
          this.capturedImage.set(base64);
          this.cameraError.set(null);
        } else {
          this.formUser.avatar = base64;
          this.showToast('✓ Fotografía convertida a Base64 y asignada al perfil');
        }
      } catch (e) {
        console.error('Error procesando imagen a Base64:', e);
      }

      input.value = '';
    }
  }

  triggerFileInput(): void {
    const ref = this.fileUploadInputRef();
    if (ref?.nativeElement) {
      ref.nativeElement.click();
    }
  }

  removeAvatar(): void {
    this.formUser.avatar = '';
    if (this.isEditing() && this.formUser.id) {
      this.userService.deleteUserPhoto(this.formUser.id);
    }
    this.showToast('Fotografía de perfil removida');
  }

  onAvatarImgError(event: Event, userObj: { avatar?: string; name?: string }): void {
    const target = event.target as HTMLImageElement;
    if (target && !target.src.includes('ui-avatars.com')) {
      target.src = this.userService.generateAvatarUrl(userObj.name || 'Usuario');
    }
  }

  /**
   * Lee un archivo de imagen, lo encuadra centrado a un cuadrado óptimo y lo comprime a Base64 JPEG
   */
  private compressFileToBase64(file: File, maxDim = 450, quality = 0.85): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const size = Math.min(img.width, img.height);
          const startX = (img.width - size) / 2;
          const startY = (img.height - size) / 2;

          const canvas = document.createElement('canvas');
          const dim = Math.min(size, maxDim);
          canvas.width = dim;
          canvas.height = dim;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, startX, startY, size, size, 0, 0, dim, dim);
            const base64Result = canvas.toDataURL('image/jpeg', quality);
            resolve(base64Result);
          } else {
            resolve(dataUrl);
          }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  // ==============================================================================
  // CÁMARA EN VIVO Y CAPTURA DE FOTO DE PERFIL EN BASE64
  // ==============================================================================

  openCameraModal(): void {
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

  stopCameraStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    const videoEl = this.videoElementRef();
    if (videoEl?.nativeElement) {
      videoEl.nativeElement.srcObject = null;
    }
  }

  async startCameraStream(): Promise<void> {
    this.stopCameraStream();
    this.isCameraLoading.set(true);
    this.cameraError.set(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.isCameraLoading.set(false);
      this.cameraError.set('Su navegador no soporta captura de video en vivo. Puede seleccionar una imagen de sus archivos.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.facingMode(),
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.attachStreamToVideo(this.mediaStream);
      this.isCameraLoading.set(false);
    } catch (err: any) {
      console.warn('Error con restricciones avanzadas de cámara, intentando modo básico:', err);
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.attachStreamToVideo(this.mediaStream);
        this.isCameraLoading.set(false);
      } catch (fallbackErr: any) {
        this.isCameraLoading.set(false);
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          this.cameraError.set('Permiso denegado. Conceda permiso de acceso a la cámara en su navegador para tomar fotos de perfil.');
        } else {
          this.cameraError.set('No se detectó una cámara activa. Puede subir una fotografía desde los archivos de su equipo.');
        }
      }
    }
  }

  private attachStreamToVideo(stream: MediaStream): void {
    setTimeout(() => {
      const videoEl = this.videoElementRef();
      if (videoEl?.nativeElement) {
        const video = videoEl.nativeElement;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        video.play().catch(e => console.log('Video play catch:', e));
      }
    }, 120);
  }

  switchCamera(): void {
    this.facingMode.update(m => m === 'user' ? 'environment' : 'user');
    this.startCameraStream();
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

    const size = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    const targetDimension = 450;
    canvas.width = targetDimension;
    canvas.height = targetDimension;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (this.facingMode() === 'user') {
        ctx.translate(targetDimension, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, startX, startY, size, size, 0, 0, targetDimension, targetDimension);
      // Generar directamente la cadena Base64 Data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      this.capturedImage.set(dataUrl);
    }
  }

  retakePhoto(): void {
    this.capturedImage.set(null);
    if (this.mediaStream && this.videoElementRef()?.nativeElement) {
      const video = this.videoElementRef()!.nativeElement;
      video.srcObject = this.mediaStream;
      video.play().catch(e => console.log('Video resume error:', e));
    } else {
      this.startCameraStream();
    }
  }

  acceptPhoto(): void {
    const photo = this.capturedImage();
    if (!photo) return;

    // Almacenar directamente la cadena Base64
    this.formUser.avatar = photo;
    this.showToast('✓ Fotografía de cámara en Base64 aplicada al perfil');
    this.closeCameraModal();
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3500);
  }
}
