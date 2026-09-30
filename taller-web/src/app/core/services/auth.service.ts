import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { User, AuthLoginResponse, AuthLoginResponseData } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  public readonly API_LOGIN_URL = 'http://localhost:8000/api/auth/login';
  private readonly STORAGE_USER_KEY = 'melecsa_auth_user';
  private readonly STORAGE_TOKEN_KEY = 'melecsa_auth_token';

  // Demo users for quick access fallback
  public readonly DEMO_USERS: User[] = [
    {
      id: 1,
      name: 'Administrador Melecsa',
      email: 'admin@melecsa.com',
      role: 'admin',
      roleLabel: 'Administración General',
      especialidad: 'Administración General',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'
    },
    {
      id: 2,
      name: 'Sofía Herrera',
      email: 'recepcion@melecsa.com',
      role: 'asesor',
      roleLabel: 'Asesora de Recepción y Servicio',
      especialidad: 'Atención a Clientes y Checklist',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150'
    },
    {
      id: 3,
      name: 'Miguel Ángel Torres',
      email: 'mecanico@melecsa.com',
      role: 'mecanico',
      roleLabel: 'Mecánico Maestro / Jefe de Taller',
      especialidad: 'Diagnóstico Electrónico & Scanner',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150'
    }
  ];

  private readonly _currentUser = signal<User | null>(this.getStoredUser());
  public readonly currentUser = this._currentUser.asReadonly();

  private readonly _token = signal<string | null>(this.getStoredToken());
  public readonly token = this._token.asReadonly();

  public readonly isAuthenticated = computed(() => !!this._currentUser() && !!this._token());

  private getStoredUser(): User | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_USER_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error reading auth user from storage', e);
    }
    return null;
  }

  private getStoredToken(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_TOKEN_KEY);
    } catch (e) {
      console.error('Error reading auth token from storage', e);
      return null;
    }
  }

  public getToken(): string | null {
    return this._token() || this.getStoredToken();
  }

  /**
   * Autenticación contra el backend en http://localhost:8000/api/auth/login
   */
  public login(email: string, password: string): Observable<AuthLoginResponse> {
    return this.http.post<AuthLoginResponse>(this.API_LOGIN_URL, {
      email: email.trim(),
      password: password
    }).pipe(
      tap(res => {
        if (res && res.success && res.data) {
          this.handleAuthSuccess(res.data);
        }
      }),
      catchError(err => {
        let message = 'Error de conexión con el servidor de autenticación.';
        if (err.error && err.error.message) {
          message = err.error.message;
        } else if (err.status === 401) {
          message = 'Credenciales incorrectas.';
        } else if (err.status === 0) {
          message = 'No se pudo conectar con el servidor en http://localhost:8000. Verifique que el servicio esté activo.';
        }
        return throwError(() => new Error(message));
      })
    );
  }

  private handleAuthSuccess(data: AuthLoginResponseData): User {
    const rawRole = (data.user.rol || 'ADMIN').toUpperCase();
    const role: 'admin' | 'asesor' | 'mecanico' =
      rawRole.includes('ASE') ? 'asesor' : (rawRole.includes('MEC') ? 'mecanico' : 'admin');

    const avatarMap: Record<string, string> = {
      admin: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
      asesor: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150',
      mecanico: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150'
    };

    const user: User = {
      id: data.user.id,
      name: data.user.nombre,
      email: data.user.email,
      role: role,
      roleLabel: data.user.especialidad || (role === 'admin' ? 'Administrador General' : data.user.rol),
      especialidad: data.user.especialidad,
      avatar: avatarMap[role] || avatarMap['admin']
    };

    this.setSession(user, data.token);
    return user;
  }

  public setSession(user: User, token: string): void {
    this._currentUser.set(user);
    this._token.set(token);
    try {
      localStorage.setItem(this.STORAGE_USER_KEY, JSON.stringify(user));
      localStorage.setItem(this.STORAGE_TOKEN_KEY, token);
    } catch (e) {
      console.error('Error saving auth to storage', e);
    }
  }

  public quickLogin(role: 'admin' | 'asesor' | 'mecanico'): void {
    const demoUser = this.DEMO_USERS.find(u => u.role === role) || this.DEMO_USERS[0];
    const demoToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.demo-token-melecsa';
    this.setSession(demoUser, demoToken);
    this.router.navigate(['/dashboard']);
  }

  public logout(): void {
    this._currentUser.set(null);
    this._token.set(null);
    try {
      localStorage.removeItem(this.STORAGE_USER_KEY);
      localStorage.removeItem(this.STORAGE_TOKEN_KEY);
    } catch (e) {
      console.error('Error removing auth from storage', e);
    }
    this.router.navigate(['/login']);
  }
}
