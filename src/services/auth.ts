// ===== Gerenciamento de Autenticação e Usuários =====

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

export function getStoredUsers(): AppUser[] {
  const stored = localStorage.getItem('app_users');
  if (!stored) {
    const users = [DEFAULT_ADMIN];
    localStorage.setItem('app_users', JSON.stringify(users));
    return users;
  }
  const users: AppUser[] = JSON.parse(stored);
  // Ensure all users have a role (migration for existing data)
  return users.map(u => ({
    ...u,
    role: u.role || (u.id === '1' ? 'admin' : 'user'),
  }));
}

export function saveUsers(users: AppUser[]) {
  localStorage.setItem('app_users', JSON.stringify(users));
}

export function getCurrentUser(): AppUser | null {
  const userJson = localStorage.getItem('current_user');
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
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
  return user?.role === 'admin';
}

export function getCurrentOwnerId(): string {
  const user = getCurrentUser();
  return user?.id || '1';
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
