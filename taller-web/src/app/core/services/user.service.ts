import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';

export interface SystemUser {
  id: string | number;
  name: string;
  email: string;
  role: 'admin' | 'asesor' | 'mecanico' | 'cajero';
  roleLabel: string;
  especialidad: string;
  phone?: string;
  status: 'activo' | 'inactivo';
  avatar: string;
  createdAt: string;
  lastLogin?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

interface ApiUser {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  telefono: string | null;
  especialidad: string | null;
  foto_perfil: string | null;
  activo: number | boolean | string | null;
  created_at: string | null;
  updated_at: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  public readonly API_USERS_URL = 'http://localhost:8000/api/usuarios';

  private readonly defaultUsers: SystemUser[] = [
    {
      id: 1,
      name: 'Administrador Melecsa',
      email: 'admin@melecsa.com',
      role: 'admin',
      roleLabel: 'Administrador General',
      especialidad: 'Administración General & Dirección',
      phone: '+52 55 9876 5432',
      status: 'activo',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
      createdAt: '2023-01-10',
      lastLogin: '2026-09-27 20:14'
    },
    {
      id: 2,
      name: 'Sofía Herrera',
      email: 'recepcion@melecsa.com',
      role: 'asesor',
      roleLabel: 'Asesor de Recepción',
      especialidad: 'Atención a Clientes & Checklist Digital',
      phone: '+52 55 4433 2211',
      status: 'activo',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150',
      createdAt: '2023-05-18',
      lastLogin: '2026-09-27 18:30'
    },
    {
      id: 3,
      name: 'Miguel Ángel Torres',
      email: 'mecanico@melecsa.com',
      role: 'mecanico',
      roleLabel: 'Mecánico de Taller',
      especialidad: 'Diagnóstico Electrónico & Scanner OBD2',
      phone: '+52 55 1290 8877',
      status: 'activo',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150',
      createdAt: '2023-06-01',
      lastLogin: '2026-09-27 17:45'
    },
    {
      id: 4,
      name: 'Valeria Cárdenas',
      email: 'caja@melecsa.com',
      role: 'cajero',
      roleLabel: 'Cajero / Cobranza',
      especialidad: 'Facturación, Cobranza & Arqueos',
      phone: '+52 55 6677 8899',
      status: 'activo',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=150',
      createdAt: '2024-02-15',
      lastLogin: '2026-09-27 16:10'
    }
  ];

  private readonly _users = signal<SystemUser[]>(this.defaultUsers);
  public readonly users = this._users.asReadonly();

  public readonly isLoading = signal<boolean>(false);
  public readonly lastError = signal<string | null>(null);

  public readonly totalUsersCount = computed(() => this._users().length);
  public readonly activeUsersCount = computed(() => this._users().filter(u => u.status === 'activo').length);
  public readonly adminUsersCount = computed(() => this._users().filter(u => u.role === 'admin').length);
  public readonly advisorUsersCount = computed(() => this._users().filter(u => u.role === 'asesor').length);

  constructor() {
    this.loadUsers();
  }

  /**
   * Carga la lista completa de usuarios desde http://localhost:8000/api/usuarios
   */
  public async loadUsers(): Promise<void> {
    this.isLoading.set(true);
    this.lastError.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<ApiUser[]>>(this.API_USERS_URL).pipe(
          catchError(err => {
            console.warn('No se pudo conectar al endpoint de usuarios de localhost:8000, usando datos locales:', err);
            return of(null);
          })
        )
      );

      if (response && response.success && Array.isArray(response.data)) {
        const mappedList = response.data.map(u => this.mapApiToSystemUser(u));
        this._users.set(mappedList);
      }
    } catch (e: any) {
      this.lastError.set(e?.message || 'Error cargando usuarios');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Obtiene el detalle actualizado de un usuario desde GET /api/usuarios/{id}
   */
  public async getUserDetail(id: string | number): Promise<SystemUser | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<ApiUser>>(`${this.API_USERS_URL}/${id}`)
      );
      if (res && res.success && res.data) {
        return this.mapApiToSystemUser(res.data);
      }
    } catch (e) {
      console.warn('Error al obtener detalle de usuario:', e);
    }
    return this.getUserById(id) || null;
  }

  /**
   * Crear un nuevo usuario conectando a POST http://localhost:8000/api/usuarios
   * Guarda directamente la imagen en Base64 en el campo foto_perfil
   */
  public async addUser(userData: Partial<SystemUser>, initialPassword?: string): Promise<SystemUser> {
    const backendRoleMap: Record<string, string> = {
      admin: 'ADMIN',
      asesor: 'RECEPCIONISTA',
      mecanico: 'MECANICO',
      cajero: 'CAJERO'
    };

    const role = (userData.role || 'asesor') as 'admin' | 'asesor' | 'mecanico' | 'cajero';
    const backendRole = backendRoleMap[role] || 'RECEPCIONISTA';

    // Almacenar directamente la cadena Base64 o URL en el campo foto_perfil
    const base64Photo = (userData.avatar && userData.avatar.trim() !== '') ? userData.avatar : null;

    const payload = {
      nombre: userData.name?.trim() || 'Nuevo Usuario',
      email: userData.email?.trim().toLowerCase() || `usuario_${Date.now()}@melecsa.com`,
      password: initialPassword || 'Password123!',
      rol: backendRole,
      telefono: userData.phone || '',
      especialidad: userData.especialidad || 'Operaciones de Taller',
      foto_perfil: base64Photo,
      activo: userData.status === 'inactivo' ? 0 : 1
    };

    const res = await firstValueFrom(
      this.http.post<ApiResponse<any>>(this.API_USERS_URL, payload)
    );

    const createdId = res?.data?.id || Date.now();
    const finalAvatar = base64Photo || this.generateAvatarUrl(payload.nombre);

    const newUser: SystemUser = {
      id: createdId,
      name: payload.nombre,
      email: payload.email,
      role,
      roleLabel: this.getRoleLabel(role),
      especialidad: payload.especialidad,
      phone: payload.telefono,
      status: payload.activo === 1 ? 'activo' : 'inactivo',
      avatar: finalAvatar,
      createdAt: new Date().toISOString().split('T')[0],
      lastLogin: 'Pendiente primer acceso'
    };

    // Recargar lista completa de usuarios desde la base de datos para sincronización total
    await this.loadUsers();

    return newUser;
  }

  /**
   * Actualizar usuario conectando a PUT http://localhost:8000/api/usuarios/{id}
   * Guarda directamente la imagen en Base64 en el campo foto_perfil
   */
  public async updateUser(id: string | number, userData: Partial<SystemUser>, password?: string): Promise<void> {
    const backendRoleMap: Record<string, string> = {
      admin: 'ADMIN',
      asesor: 'RECEPCIONISTA',
      mecanico: 'MECANICO',
      cajero: 'CAJERO'
    };

    const payload: any = {};
    if (userData.name) payload.nombre = userData.name.trim();
    if (userData.email) payload.email = userData.email.trim().toLowerCase();
    if (userData.role) payload.rol = backendRoleMap[userData.role] || userData.role;
    if (userData.phone !== undefined) payload.telefono = userData.phone;
    if (userData.especialidad !== undefined) payload.especialidad = userData.especialidad;
    if (userData.status !== undefined) payload.activo = userData.status === 'activo' ? 1 : 0;
    if (password) payload.password = password;

    // Guardar siempre el Base64 o URL directamente en foto_perfil
    if (userData.avatar !== undefined) {
      payload.foto_perfil = userData.avatar ? userData.avatar : null;
    }

    await firstValueFrom(
      this.http.put(`${this.API_USERS_URL}/${id}`, payload)
    );

    // Recargar lista completa de usuarios desde la base de datos
    await this.loadUsers();
  }

  /**
   * Eliminar foto de perfil en el servidor (pone foto_perfil en NULL)
   */
  public async deleteUserPhoto(id: string | number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(`${this.API_USERS_URL}/${id}`, { foto_perfil: null })
      );
      await this.loadUsers();
    } catch (e) {
      console.warn('Error eliminando foto de perfil:', e);
    }
  }

  /**
   * Eliminar o desactivar usuario conectando a DELETE http://localhost:8000/api/usuarios/{id}
   */
  public async deleteUser(id: string | number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.API_USERS_URL}/${id}`)
      );
    } catch (err) {
      console.warn(`Error en DELETE /api/usuarios/${id}:`, err);
    }

    await this.loadUsers();
  }

  /**
   * Alternar estado activo / inactivo
   */
  public async toggleStatus(id: string | number): Promise<void> {
    const user = this._users().find(u => u.id === id);
    if (!user) return;

    const nextStatus = user.status === 'activo' ? 'inactivo' : 'activo';
    const nextActivo = nextStatus === 'activo' ? 1 : 0;

    try {
      await firstValueFrom(
        this.http.put(`${this.API_USERS_URL}/${id}`, { activo: nextActivo })
      );
    } catch (err) {
      console.warn(`Error al actualizar estado en /api/usuarios/${id}:`, err);
    }

    await this.loadUsers();
  }

  public getUserById(id: string | number): SystemUser | undefined {
    return this._users().find(u => u.id === id);
  }

  /**
   * Mapea un usuario de la API al modelo SystemUser del frontend
   */
  public mapApiToSystemUser(apiUser: ApiUser): SystemUser {
    const rawRole = (apiUser.rol || 'RECEPCIONISTA').toUpperCase();
    let role: 'admin' | 'asesor' | 'mecanico' | 'cajero' = 'asesor';

    if (rawRole === 'ADMIN') {
      role = 'admin';
    } else if (rawRole === 'MECANICO') {
      role = 'mecanico';
    } else if (rawRole === 'CAJERO') {
      role = 'cajero';
    } else {
      role = 'asesor';
    }

    const isActive = apiUser.activo === 1 || apiUser.activo === true || apiUser.activo === '1';

    let avatar = apiUser.foto_perfil;
    if (!avatar || avatar.trim() === '') {
      avatar = this.generateAvatarUrl(apiUser.nombre);
    } else if (avatar.startsWith('/uploads/')) {
      avatar = `http://localhost:8000${avatar}`;
    }

    return {
      id: apiUser.id,
      name: apiUser.nombre,
      email: apiUser.email,
      role,
      roleLabel: this.getRoleLabel(role),
      especialidad: apiUser.especialidad || 'Operaciones de Taller',
      phone: apiUser.telefono || '',
      status: isActive ? 'activo' : 'inactivo',
      avatar,
      createdAt: apiUser.created_at ? apiUser.created_at.split(' ')[0] : '2026-09-27',
      lastLogin: apiUser.updated_at ? apiUser.updated_at.split(' ')[0] : 'Reciente'
    };
  }

  private getRoleLabel(role: 'admin' | 'asesor' | 'mecanico' | 'cajero'): string {
    const map: Record<string, string> = {
      admin: 'Administrador General',
      asesor: 'Asesor de Recepción',
      mecanico: 'Mecánico de Taller',
      cajero: 'Cajero / Cobranza'
    };
    return map[role] || 'Usuario del Taller';
  }

  public generateAvatarUrl(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=0284c7&color=ffffff&bold=true`;
  }
}
