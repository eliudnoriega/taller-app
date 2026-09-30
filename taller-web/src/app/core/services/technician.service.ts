import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { Mechanic } from '../models/client-vehicle.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class TechnicianService {
  private http = inject(HttpClient);
  public readonly API_MECANICOS_URL = 'http://localhost:8000/api/usuarios/mecanicos';
  public readonly API_USUARIOS_URL = 'http://localhost:8000/api/usuarios';

  private readonly defaultTechnicians: Mechanic[] = [
    {
      id: 'MEC-01',
      name: 'Roberto Valdés',
      specialty: 'Mecánica General y Frenos',
      phone: '+52 55 4123 8890',
      email: 'roberto.valdes@melecsa.com',
      activeOrdersCount: 2,
      completedOrdersCount: 48,
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=150',
      status: 'activo',
      hireDate: '2023-03-15',
      rating: 4.9
    },
    {
      id: 'MEC-02',
      name: 'Alejandro Morales',
      specialty: 'Diagnóstico Electrónico & Scanner OBD2',
      phone: '+52 55 8923 1122',
      email: 'alejandro.morales@melecsa.com',
      activeOrdersCount: 1,
      completedOrdersCount: 62,
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150',
      status: 'activo',
      hireDate: '2022-08-01',
      rating: 4.95
    },
    {
      id: 'MEC-03',
      name: 'Luis Fernando Ruiz',
      specialty: 'Suspensión, Dirección y Transmisión',
      phone: '+52 55 7711 3344',
      email: 'luis.ruiz@melecsa.com',
      activeOrdersCount: 1,
      completedOrdersCount: 35,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150',
      status: 'activo',
      hireDate: '2024-01-10',
      rating: 4.8
    },
    {
      id: 'MEC-04',
      name: 'Jorge Hernández',
      specialty: 'Aire Acondicionado & Climatización Automotriz',
      phone: '+52 55 6543 2109',
      email: 'jorge.hernandez@melecsa.com',
      activeOrdersCount: 0,
      completedOrdersCount: 29,
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=150',
      status: 'vacaciones',
      hireDate: '2023-11-20',
      rating: 4.7
    }
  ];

  private readonly _technicians = signal<Mechanic[]>(this.defaultTechnicians);
  public readonly technicians = this._technicians.asReadonly();

  public readonly totalCount = computed(() => this._technicians().length);
  public readonly activeCount = computed(() => this._technicians().filter(t => t.status === 'activo').length);
  public readonly onVacationCount = computed(() => this._technicians().filter(t => t.status === 'vacaciones').length);
  public readonly totalActiveOrders = computed(() => this._technicians().reduce((acc, t) => acc + t.activeOrdersCount, 0));

  constructor() {
    this.loadTechnicians();
  }

  public async loadTechnicians(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<any[]>>(this.API_MECANICOS_URL).pipe(
          catchError(() => of(null))
        )
      );

      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const backendMecs: Mechanic[] = res.data.map((m: any, idx: number) => {
          let avatar = m.foto_perfil;
          if (!avatar) {
            avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nombre)}&background=0284c7&color=fff`;
          } else if (avatar.startsWith('/uploads/')) {
            avatar = `http://localhost:8000${avatar}`;
          }

          return {
            id: `MEC-${String(m.id).padStart(2, '0')}`,
            name: m.nombre,
            specialty: m.especialidad || 'Mecánica General',
            phone: m.telefono || '+52 55 0000 0000',
            email: m.email,
            activeOrdersCount: idx % 3,
            completedOrdersCount: 20 + (idx * 7),
            avatar,
            status: 'activo' as const,
            hireDate: '2023-06-15',
            rating: 4.8 + ((idx % 3) * 0.1)
          };
        });

        // Combinar evitando duplicados
        const ids = new Set(backendMecs.map(m => m.name.toLowerCase()));
        const remainingDefaults = this.defaultTechnicians.filter(d => !ids.has(d.name.toLowerCase()));
        this._technicians.set([...backendMecs, ...remainingDefaults]);
      }
    } catch (e) {
      console.warn('Error al cargar mecánicos del backend:', e);
    }
  }

  public addTechnician(data: Partial<Mechanic>): Mechanic {
    const nextNum = this._technicians().length + 1;
    const newTech: Mechanic = {
      id: data.id || `MEC-0${nextNum}`,
      name: data.name || 'Nuevo Técnico',
      specialty: data.specialty || 'Mecánica General',
      phone: data.phone || '+52 55 0000 0000',
      email: data.email || 'tecnico@melecsa.com',
      activeOrdersCount: data.activeOrdersCount || 0,
      completedOrdersCount: data.completedOrdersCount || 0,
      avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'Tecnico')}&background=0284c7&color=fff`,
      status: data.status || 'activo',
      hireDate: data.hireDate || new Date().toISOString().split('T')[0],
      rating: data.rating || 5.0
    };

    // Intentar sincronizar con el backend en segundo plano
    this.http.post(this.API_USUARIOS_URL, {
      nombre: newTech.name,
      email: newTech.email,
      password: 'Password123!',
      rol: 'MECANICO',
      telefono: newTech.phone,
      especialidad: newTech.specialty,
      foto_perfil: newTech.avatar,
      activo: 1
    }).pipe(catchError(() => of(null))).subscribe();

    this._technicians.update(list => [newTech, ...list]);
    return newTech;
  }

  public updateTechnician(id: string, data: Partial<Mechanic>): void {
    this._technicians.update(list => list.map(t => {
      if (t.id === id) {
        return { ...t, ...data };
      }
      return t;
    }));
  }

  public deleteTechnician(id: string): void {
    this._technicians.update(list => list.filter(t => t.id !== id));
  }

  public toggleStatus(id: string, status: 'activo' | 'inactivo' | 'vacaciones'): void {
    this._technicians.update(list => list.map(t => t.id === id ? { ...t, status } : t));
  }

  public getTechnicianById(id: string): Mechanic | undefined {
    return this._technicians().find(t => t.id === id);
  }
}
