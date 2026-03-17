// ===== Gerenciamento de Autenticação e Usuários =====
// Suporta localStorage (Lovable/cloud) e API backend (VPS)

import api from '@/services/api';
import type { SaasUser } from '@/services/api';

export interface AppUser {
  id: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: 'admin' | 'user';
  client_limit?: number;
  expires_at?: string | null;
  permissions?: string[];
  createdAt: string;
}

const DEFAULT_ADMIN: AppUser = {
  id: '1',
  email: 'admin@cobranca.com',
  password: 'admin123',
  name: 'Administrador',
  role: 'admin',
  createdAt: new Date().toISOString(),
};

function seedDefaultUsers(): AppUser[] {
  const users = [DEFAULT_ADMIN];
  localStorage.setItem('app_users', JSON.stringify(users));
  return users;
}

function normalizeStoredUsers(value: unknown): AppUser[] {
  if (!Array.isArray(value) || value.length === 0) {
    return seedDefaultUsers();
  }

  const users = value
    .filter((item): item is Partial<AppUser> => !!item && typeof item === 'object')
    .map((user, index) => ({
      id: String(user.id ?? index + 1),
      email: String(user.email ?? '').trim().toLowerCase(),
      password: typeof user.password === 'string' ? user.password : '',
      name: String(user.name ?? '').trim(),
      role: index === 0 ? 'admin' as const : 'user' as const,
      createdAt: typeof user.createdAt === 'string' && user.createdAt ? user.createdAt : new Date().toISOString(),
    }))
    .filter(user => user.email && user.password && user.name);

  if (users.length === 0) {
    return seedDefaultUsers();
  }

  localStorage.setItem('app_users', JSON.stringify(users));
  return users;
}

// ===== Detect if we're on VPS (API mode) =====

function isVpsMode(): boolean {
  // Sempre usar API da VPS — preview do Lovable conecta via proxy
  return true;
}

export { isVpsMode };

// ===== localStorage-based auth (Lovable/cloud mode) =====

export function getStoredUsers(): AppUser[] {
  const stored = localStorage.getItem('app_users');
  if (!stored) {
    return seedDefaultUsers();
  }

  try {
    return normalizeStoredUsers(JSON.parse(stored));
  } catch {
    return seedDefaultUsers();
  }
}

export function saveUsers(users: AppUser[]) {
  localStorage.setItem('app_users', JSON.stringify(users));
}

export function getCurrentUser(): AppUser | null {
  const userJson = localStorage.getItem('current_user');
  const token = localStorage.getItem('auth_token');

  if (!userJson) {
    localStorage.removeItem('auth_token');
    return null;
  }

  try {
    const user: AppUser = JSON.parse(userJson);

    // Em modo VPS, só aceita sessão real do backend (JWT com 3 partes)
    if (isVpsMode()) {
      const isJwt = Boolean(token && token.split('.').length === 3);
      if (!isJwt || !user?.id) {
        localStorage.removeItem('current_user');
        localStorage.removeItem('auth_token');
        return null;
      }
      return user;
    }

    // In cloud mode, validate against stored users list
    const users = getStoredUsers();
    const matchedUser = users.find(u => u.id === user.id);

    if (!matchedUser) {
      localStorage.removeItem('current_user');
      localStorage.removeItem('auth_token');
      return null;
    }

    return { ...matchedUser, role: matchedUser.role };
  } catch {
    localStorage.removeItem('current_user');
    localStorage.removeItem('auth_token');
    return null;
  }
}

export function setCurrentUser(user: AppUser) {
  localStorage.setItem('current_user', JSON.stringify(user));
}

export function clearCurrentUser() {
  localStorage.removeItem('current_user');
}

export function isAdmin(): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  return user.role === 'admin';
}

export function getCurrentOwnerId(): string {
  const user = getCurrentUser();
  return user?.id || '';
}

// ===== VPS API-based auth =====

function unwrapApiData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export async function loginVps(email: string, password: string): Promise<AppUser> {
  const res = await api.login(email, password);
  if (!res.success || !res.data) throw new Error(res.error || 'Erro ao fazer login');

  const payload = unwrapApiData<{ token: string; user: SaasUser }>(res.data);
  const { token, user } = payload;

  if (!token || !user?.id) {
    throw new Error('Resposta inválida do servidor ao fazer login');
  }

  const appUser: AppUser = {
    id: String(user.id),
    email: user.email,
    password: '',
    name: user.name,
    phone: user.phone,
    role: user.role || 'user',
    client_limit: user.client_limit,
    expires_at: user.expires_at,
    permissions: user.permissions,
    createdAt: user.createdAt || '',
  };

  api.setToken(token);
  setCurrentUser(appUser);
  localStorage.setItem('auth_token', token);

  return appUser;
}

export async function registerVps(data: { name: string; email: string; password: string; phone?: string; client_limit?: number; expires_at?: string | null; permissions?: string[] }): Promise<void> {
  const res = await api.register(data);
  if (!res.success) throw new Error(res.error || 'Erro ao registrar');
}

export async function fetchUsersVps(): Promise<AppUser[]> {
  const res = await api.getUsers();
  if (!res.success || !res.data) throw new Error(res.error || 'Erro ao listar usuários');

  const users = unwrapApiData<SaasUser[]>(res.data);
  return users.map(u => ({
    id: String(u.id),
    email: u.email,
    password: '',
    name: u.name,
    phone: u.phone,
    role: u.role || 'user',
    client_limit: u.client_limit,
    expires_at: u.expires_at,
    permissions: u.permissions,
    createdAt: u.createdAt || '',
  }));
}

export async function updateUserVps(id: string, data: Partial<{ name: string; email: string; phone: string; password: string; client_limit: number; expires_at: string | null; permissions: string[]; is_active: boolean }>): Promise<void> {
  const res = await api.updateUser(id, data);
  if (!res.success) throw new Error(res.error || 'Erro ao atualizar usuário');
}
export async function deleteUserVps(id: string): Promise<void> {
  const res = await api.deleteUser(id);
  if (!res.success) throw new Error(res.error || 'Erro ao remover usuário');
}


// ===== User-scoped localStorage =====
// Prefixes keys with user ID for isolated config per user

function userPrefix(): string {
  return `user_${getCurrentOwnerId()}_`;
}

export function userStorageGet(key: string): string | null {
  return localStorage.getItem(userPrefix() + key);
}

export function userStorageSet(key: string, value: string): void {
  localStorage.setItem(userPrefix() + key, value);
}

export function userStorageRemove(key: string): void {
  localStorage.removeItem(userPrefix() + key);
}
