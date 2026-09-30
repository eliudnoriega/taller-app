import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TechnicianService } from '../../core/services/technician.service';
import { NotificationService } from '../../core/services/notification.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { Mechanic } from '../../core/models/client-vehicle.model';

@Component({
  selector: 'app-technicians',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './technicians.component.html',
  styleUrl: './technicians.component.css'
})
export class TechniciansComponent {
  public techService = inject(TechnicianService);
  public notifService = inject(NotificationService);

  searchTerm = signal<string>('');
  selectedStatusFilter = signal<string>('todos');
  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  toastMessage = signal<string | null>(null);

  // Form state for Create / Edit
  currentTech: Partial<Mechanic> = {
    id: '',
    name: '',
    specialty: 'Mecánica General y Frenos',
    phone: '',
    email: '',
    status: 'activo',
    rating: 5.0,
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=150'
  };

  specialtiesList = [
    'Mecánica General y Frenos',
    'Diagnóstico Electrónico & Scanner OBD2',
    'Suspensión, Dirección y Transmisión',
    'Aire Acondicionado & Climatización Automotriz',
    'Afinación Mayor e Inyección Electrónica',
    'Motores Gasolina y Diésel Ligero'
  ];

  filteredTechnicians = computed(() => {
    const list = this.techService.technicians();
    const query = this.searchTerm().trim().toLowerCase();
    const status = this.selectedStatusFilter();

    return list.filter(t => {
      const matchStatus = status === 'todos' || t.status === status;
      const matchQuery = !query ||
        t.name.toLowerCase().includes(query) ||
        t.specialty.toLowerCase().includes(query) ||
        t.phone.toLowerCase().includes(query) ||
        (t.email && t.email.toLowerCase().includes(query));
      return matchStatus && matchQuery;
    });
  });

  openCreateModal(): void {
    this.isEditing.set(false);
    this.currentTech = {
      name: '',
      specialty: 'Mecánica General y Frenos',
      phone: '',
      email: '',
      status: 'activo',
      rating: 5.0,
      avatar: this.getRandomAvatar()
    };
    this.isModalOpen.set(true);
  }

  openEditModal(tech: Mechanic): void {
    this.isEditing.set(true);
    this.currentTech = { ...tech };
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  saveTechnician(): void {
    if (!this.currentTech.name?.trim()) {
      alert('Por favor ingrese el nombre del técnico.');
      return;
    }

    if (this.isEditing() && this.currentTech.id) {
      this.techService.updateTechnician(this.currentTech.id, this.currentTech);
      this.showToast(`Técnico ${this.currentTech.name} actualizado exitosamente`);
    } else {
      const created = this.techService.addTechnician(this.currentTech);
      this.showToast(`Técnico ${created.name} registrado con ID ${created.id}`);
    }

    this.closeModal();
  }

  deleteTechnician(tech: Mechanic): void {
    if (tech.activeOrdersCount > 0) {
      alert(`No se puede eliminar a ${tech.name} porque tiene ${tech.activeOrdersCount} órdenes activas asignadas. Reasigne las órdenes primero.`);
      return;
    }

    if (confirm(`¿Está seguro de eliminar al técnico ${tech.name}?`)) {
      this.techService.deleteTechnician(tech.id);
      this.showToast(`Técnico ${tech.name} eliminado del sistema`);
    }
  }

  toggleStatus(tech: Mechanic, status: 'activo' | 'inactivo' | 'vacaciones'): void {
    this.techService.toggleStatus(tech.id, status);
    const statusLabels: Record<string, string> = {
      activo: 'Activo',
      inactivo: 'Inactivo',
      vacaciones: 'En Vacaciones'
    };
    this.showToast(`Estado de ${tech.name} cambiado a: ${statusLabels[status]}`);
  }

  contactWhatsApp(tech: Mechanic): void {
    const cleanPhone = (tech.phone || '').replace(/[^0-9]/g, '');
    const msg = `Hola ${tech.name} 👋, te contactamos desde la administración de MELECSA.`;
    const url = this.notifService.generateWhatsAppUrl(cleanPhone || '525541238890', msg);
    window.open(url, '_blank');
  }

  getRandomAvatar(): string {
    const avatars = [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=150',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=150',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150'
    ];
    return avatars[Math.floor(Math.random() * avatars.length)];
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 3500);
  }
}
