// ===== Gerenciamento de Autenticação e Usuários =====
// Suporta localStorage (Lovable/cloud) e API backend (VPS)

import api from '@/services/api';

export interface AppUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'user';
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
  const forced = String(import.meta.env.VITE_DATA_BACKEND || '').toLowerCase();
  if (forced === 'cloud') return false;
  if (forced === 'api') return true;

  const hostname = window.location.hostname.toLowerCase();
  const isLovableHost =
    hostname.endsWith('.lovable.app') ||
    hostname.endsWith('.lovableproject.com') ||
    hostname.includes('lovable');

  if (isLovableHost) return false;

  // Only VPS if there's an explicit API base URL configured
  if (typeof window !== 'undefined') {
    const storedApi = window.localStorage.getItem('api_base_url')?.trim();
    if (storedApi) return true;
  }
  const envApi = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  if (envApi && envApi !== '/api') return true;

  // localhost without configured API → not VPS
  return false;
}

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
  if (!userJson) {
    localStorage.removeItem('auth_token');
    return null;
  }

  try {
    const user: AppUser = JSON.parse(userJson);

    // In VPS mode, trust stored user directly (came from backend)
    if (isVpsMode()) {
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

export async function loginVps(email: string, password: string): Promise<AppUser> {
  const res = await api.login(email, password);
  if (!res.success || !res.data) throw new Error(res.error || 'Erro ao fazer login');

  const { token, user } = res.data;
  const appUser: AppUser = {
    id: String(user.id),
    email: user.email,
    password: '', // never store password
    name: user.name,
    role: (user.role as 'admin' | 'user') || 'user',
    createdAt: '',
  };

  api.setToken(token);
  setCurrentUser(appUser);
  localStorage.setItem('auth_token', token);

  return appUser;
}

export async function registerVps(name: string, email: string, password: string): Promise<void> {
  const res = await api.register(name, email, password);
  if (!res.success) throw new Error(res.error || 'Erro ao registrar');
}

export async function fetchUsersVps(): Promise<AppUser[]> {
  const res = await api.getUsers();
  if (!res.success || !res.data) throw new Error(res.error || 'Erro ao listar usuários');
  return res.data.map(u => ({
    id: String(u.id),
    email: u.email,
    password: '',
    name: u.name,
    role: (u.role as 'admin' | 'user') || 'user',
    createdAt: u.createdAt || '',
  }));
}

export async function deleteUserVps(id: string): Promise<void> {
  const res = await api.deleteUser(id);
  if (!res.success) throw new Error(res.error || 'Erro ao remover usuário');
}

export { isVpsMode };

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
