export interface BackendUser {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  especialidad: string;
}

export interface AuthLoginResponseData {
  token: string;
  token_type: string;
  expires_in: number;
  user: BackendUser;
}

export interface AuthLoginResponse {
  success: boolean;
  message: string;
  data: AuthLoginResponseData;
  timestamp: string;
}

export interface AuthErrorResponse {
  success: boolean;
  message: string;
  errors?: any;
  timestamp: string;
}

export interface User {
  id: string | number;
  name: string;
  email: string;
  role: 'admin' | 'asesor' | 'mecanico';
  roleLabel: string;
  avatar: string;
  especialidad?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}
