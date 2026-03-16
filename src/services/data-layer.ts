// ===================================================================
// CAMADA DE DADOS UNIFICADA — REGRA @@ (ISOLAMENTO RÍGIDO)
// ===================================================================
// REGRA DE OURO (@@):
// 1) Toda leitura/escrita de dados passa por este arquivo.
// 2) Nenhuma página/componente pode importar cliente de banco direto.
// 3) Se existir API VPS configurada, ela tem prioridade total.
//
// MAPA DE AMBIENTE:
// ┌──────────────────────────────────────────────┬────────────────────┐
// │ VITE_DATA_BACKEND=api|cloud                  │ força backend      │
// │ VITE_API_BASE_URL absoluto/configurado       │ API REST -> VPS    │
// │ Host com .lovable.app/.lovableproject.com    │ Cloud de teste     │
// │ localhost / VPS / domínio próprio            │ API REST -> VPS    │
// └──────────────────────────────────────────────┴────────────────────┘
// ===================================================================

import { supabase } from '@/integrations/supabase/client';
import api from '@/services/api';
import type { Client, MessageTemplate, DashboardStats } from '@/types/billing';
import { addOperationLog } from '@/services/operation-logger';
import { getCurrentOwnerId, isAdmin, userStorageGet, userStorageSet } from '@/services/auth';

// Helper: creates headers with auth token + owner ID for raw fetch calls
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  const token = localStorage.getItem('auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const ownerId = getCurrentOwnerId();
  if (ownerId) headers['X-Owner-Id'] = ownerId;
  return headers;
}

function normalizeApiBaseUrl(value?: string | null): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const normalized = trimmed.replace(/\/+$/, '');
  if (normalized === '/api' || normalized.endsWith('/api')) return normalized;
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return `${normalized}/api`;
  return normalized;
}

// Detect if we need to proxy through edge function (HTTPS preview → HTTP VPS)
function needsProxy(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  const isHttps = window.location.protocol === 'https:';
  const vpsUrl = window.localStorage.getItem('api_base_url')?.trim() || '';
  const isVpsHttp = vpsUrl.startsWith('http://');
  return isHttps && isVpsHttp;
}

function getProxyBaseUrl(): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'pmnanfzbtimcfyzndeyq';
  return `https://${projectId}.supabase.co/functions/v1/vps-proxy`;
}

// Helper: resolves the correct base URL for raw fetch calls
function apiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const stored = normalizeApiBaseUrl(window.localStorage.getItem('api_base_url'));
    if (stored) return stored;
  }
  const env = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  return env || '/api';
}

async function safeJsonParse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text.trim()) return {};

  // Detect HTML responses (Nginx error pages, 502, etc.)
  if (text.trim().startsWith('<') || text.trim().startsWith('<!')) {
    const status = res.status;
    if (status === 502 || status === 503 || status === 504) {
      throw new Error(`Servidor VPS indisponível (HTTP ${status}). Verifique se o PM2 está rodando.`);
    }
    throw new Error(`Servidor retornou HTML em vez de JSON (HTTP ${status}). O backend pode estar fora do ar.`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Resposta inválida do servidor (HTTP ${res.status}): ${text.substring(0, 120)}`);
  }
}

function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const headers = authHeaders(options.headers as Record<string, string> || {});

  if (needsProxy()) {
    const vpsUrl = apiBaseUrl();
    const proxyUrl = `${getProxyBaseUrl()}?vps_url=${encodeURIComponent(vpsUrl)}&endpoint=${encodeURIComponent(endpoint)}`;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
    return fetch(proxyUrl, {
      ...options,
      headers: { ...headers, apikey: anonKey },
    });
  }

  const base = apiBaseUrl();
  return fetch(`${base}${endpoint}`, {
    ...options,
    headers,
  });
}

type DataBackend = 'cloud' | 'api';

function getConfiguredApiBaseUrl(): string {
  const envApiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

  if (typeof window !== 'undefined') {
    const storedApiBaseUrl = normalizeApiBaseUrl(window.localStorage.getItem('api_base_url'));
    if (storedApiBaseUrl) return storedApiBaseUrl;
  }

  return envApiBaseUrl;
}

function hasConfiguredApiBaseUrl(): boolean {
  const configuredUrl = getConfiguredApiBaseUrl();
  return Boolean(configuredUrl && configuredUrl !== '/api');
}

function resolveDataBackend(): DataBackend {
  // Sempre usar API da VPS — banco cloud desativado
  return 'api';
}

const ACTIVE_DATA_BACKEND: DataBackend = 'api';

const isLovableEnv = () => false;

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateOnly(value: unknown): string | undefined {
  if (!value) return undefined;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatLocalDate(value);
  }

  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (DATE_ONLY_REGEX.test(trimmed)) return trimmed;

  const datePart = trimmed.split('T')[0]?.split(' ')[0];
  if (datePart && DATE_ONLY_REGEX.test(datePart)) return datePart;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return formatLocalDate(parsed);
}

// ===== CLIENTES =====

export async function fetchClients(): Promise<Client[]> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    let result: Client[];
    if (isLovableEnv()) {
      let query = supabase.from('clients').select('*').order('name');
      if (!isAdmin()) {
        query = query.eq('owner_id', getCurrentOwnerId());
      }
      const { data, error } = await query;
      if (error) throw error;
      result = (data || []).map((c: any) => ({ ...c, due_date: normalizeDateOnly(c.due_date), amount: c.amount ? Number(c.amount) : undefined }));
    } else {
      const res = await api.getClients();
      if (!res.success || !res.data) throw new Error(res.error || 'Erro ao buscar clientes');
      result = (res.data.data || []).map((c: any) => ({ ...c, due_date: normalizeDateOnly(c.due_date), amount: c.amount ? Number(c.amount) : undefined }));
    }
    addOperationLog(backend, 'Clientes', 'SELECT', `Listou ${result.length} clientes`);
    return result;
  } catch (err: any) {
    addOperationLog(backend, 'Clientes', 'SELECT', 'Erro ao listar clientes', 'error', err?.message);
    throw err;
  }
}

export async function createClient(client: Partial<Client>): Promise<void> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    if (isLovableEnv()) {
      const { error } = await supabase.from('clients').insert({ name: client.name, email: client.email || null, phone: client.phone, phone2: client.phone2 || null, document: client.document || null, amount: client.amount || null, due_date: client.due_date || null, owner_id: getCurrentOwnerId() } as any);
      if (error) throw error;
    } else {
      const res = await api.createClient({ ...client, owner_id: getCurrentOwnerId() } as any);
      if (!res.success) throw new Error(res.error || 'Erro ao criar cliente');
    }
    addOperationLog(backend, 'Clientes', 'INSERT', `Criou cliente "${client.name}"`);
  } catch (err: any) {
    addOperationLog(backend, 'Clientes', 'INSERT', `Erro ao criar "${client.name}"`, 'error', err?.message);
    throw err;
  }
}

export async function upsertClientFromTraccar(client: { name: string; phone: string; email?: string }): Promise<'created' | 'updated' | 'skipped'> {
  const backend = ACTIVE_DATA_BACKEND;
  const ownerId = getCurrentOwnerId();
  try {
    if (isLovableEnv()) {
      // Try to find existing client by traccar_email within the same owner
      let existing: any[] | null = null;
      if (client.email) {
        const { data } = await supabase.from('clients').select('id, name, phone, email, traccar_email')
          .eq('traccar_email', client.email)
          .eq('owner_id', ownerId)
          .limit(1);
        existing = data;
      }

      if (existing && existing.length > 0) {
        const current = existing[0];
        const needsUpdate = current.name !== client.name || current.phone !== client.phone || current.email !== (client.email || null);
        if (!needsUpdate) return 'skipped';

        const { error } = await supabase.from('clients').update({
          name: client.name,
          phone: client.phone,
          email: client.email || null,
          updated_at: new Date().toISOString(),
        }).eq('id', current.id);
        if (error) throw error;
        addOperationLog(backend, 'Clientes', 'UPDATE', `Atualizou cliente Traccar "${client.name}"`);
        return 'updated';
      }

      // Also check by name within same owner to avoid duplicates
      const { data: byName } = await supabase.from('clients').select('id')
        .eq('name', client.name)
        .eq('owner_id', ownerId)
        .limit(1);
      if (byName && byName.length > 0) {
        const { error } = await supabase.from('clients').update({
          phone: client.phone,
          email: client.email || null,
          traccar_email: client.email || null,
          updated_at: new Date().toISOString(),
        }).eq('id', byName[0].id);
        if (error) throw error;
        addOperationLog(backend, 'Clientes', 'UPDATE', `Vinculou Traccar ao cliente "${client.name}"`);
        return 'updated';
      }

      // Also check by phone within same owner
      const { data: byPhone } = await supabase.from('clients').select('id')
        .eq('phone', client.phone)
        .eq('owner_id', ownerId)
        .limit(1);
      if (byPhone && byPhone.length > 0) {
        const { error } = await supabase.from('clients').update({
          name: client.name,
          email: client.email || null,
          traccar_email: client.email || null,
          updated_at: new Date().toISOString(),
        }).eq('id', byPhone[0].id);
        if (error) throw error;
        addOperationLog(backend, 'Clientes', 'UPDATE', `Vinculou Traccar ao cliente "${client.name}" por telefone`);
        return 'updated';
      }

      // Create new client
      const { error } = await supabase.from('clients').insert({ name: client.name, phone: client.phone, email: client.email || null, traccar_email: client.email || null, owner_id: ownerId } as any);
      if (error) {
        if (error.code === '23505') return 'skipped';
        throw error;
      }
    } else {
      // VPS mode: try to find existing client and upsert
      const allClients = await api.getClients(1, client.email || client.name);
      const clients = allClients.success ? (allClients.data as any)?.data || [] : [];
      
      // Check by traccar_email
      const byEmail = client.email ? clients.find((c: any) => c.traccar_email === client.email) : null;
      if (byEmail) {
        const needsUpdate = byEmail.name !== client.name || byEmail.phone !== client.phone || byEmail.email !== (client.email || null);
        if (!needsUpdate) return 'skipped';
        await api.updateClient(byEmail.id, { name: client.name, phone: client.phone, email: client.email || null });
        addOperationLog(backend, 'Clientes', 'UPDATE', `Atualizou cliente Traccar "${client.name}"`);
        return 'updated';
      }
      
      // Check by name
      const byName = clients.find((c: any) => c.name === client.name);
      if (byName) {
        await api.updateClient(byName.id, { phone: client.phone, email: client.email || null, traccar_email: client.email || null } as any);
        addOperationLog(backend, 'Clientes', 'UPDATE', `Vinculou Traccar ao cliente "${client.name}"`);
        return 'updated';
      }
      
      // Check by phone
      const allByPhone = await api.getClients(1, client.phone);
      const phoneClients = allByPhone.success ? (allByPhone.data as any)?.data || [] : [];
      const byPhone = phoneClients.find((c: any) => c.phone === client.phone);
      if (byPhone) {
        await api.updateClient(byPhone.id, { name: client.name, email: client.email || null, traccar_email: client.email || null } as any);
        addOperationLog(backend, 'Clientes', 'UPDATE', `Vinculou Traccar ao cliente "${client.name}" por telefone`);
        return 'updated';
      }
      
      // Create new
      const res = await api.createClient({ name: client.name, phone: client.phone, email: client.email || null, traccar_email: client.email || null } as any);
      if (!res.success) throw new Error(res.error || 'Erro ao criar cliente');
    }
    addOperationLog(backend, 'Clientes', 'INSERT', `Importou cliente Traccar "${client.name}"`);
    return 'created';
  } catch (err: any) {
    if (err?.code === '23505') return 'skipped';
    addOperationLog(backend, 'Clientes', 'INSERT', `Erro ao importar "${client.name}"`, 'error', err?.message);
    throw err;
  }
}

export async function updateClient(id: number, client: Partial<Client>): Promise<void> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    if (isLovableEnv()) {
      const { error } = await supabase.from('clients').update({ ...client, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    } else {
      const res = await api.updateClient(id, client);
      if (!res.success) throw new Error(res.error || 'Erro ao atualizar cliente');
    }
    addOperationLog(backend, 'Clientes', 'UPDATE', `Atualizou cliente #${id}`);
  } catch (err: any) {
    addOperationLog(backend, 'Clientes', 'UPDATE', `Erro ao atualizar #${id}`, 'error', err?.message);
    throw err;
  }
}

export async function deleteClient(id: number): Promise<void> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    if (isLovableEnv()) {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    } else {
      const res = await api.deleteClient(id);
      if (!res.success) throw new Error(res.error || 'Erro ao remover cliente');
    }
    addOperationLog(backend, 'Clientes', 'DELETE', `Removeu cliente #${id}`);
  } catch (err: any) {
    addOperationLog(backend, 'Clientes', 'DELETE', `Erro ao remover #${id}`, 'error', err?.message);
    throw err;
  }
}

// ===== TEMPLATES DE MENSAGEM =====

export async function fetchMessageTemplates(): Promise<MessageTemplate[]> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    let result: MessageTemplate[];
    if (isLovableEnv()) {
      const { data, error } = await supabase.from('message_templates').select('*').order('id');
      if (error) throw error;
      result = (data || []) as MessageTemplate[];
    } else {
      const res = await api.getMessageTemplates();
      if (!res.success || !res.data) throw new Error(res.error || 'Erro ao buscar templates');
      result = res.data;
    }
    addOperationLog(backend, 'Templates', 'SELECT', `Listou ${result.length} templates`);
    return result;
  } catch (err: any) {
    addOperationLog(backend, 'Templates', 'SELECT', 'Erro ao listar templates', 'error', err?.message);
    throw err;
  }
}

export async function getReceiptTemplate(): Promise<MessageTemplate | null> {
  return getTemplateByType('receipt');
}

export async function getTemplateByType(type: string): Promise<MessageTemplate | null> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    let result: MessageTemplate | null;
    if (isLovableEnv()) {
      const { data } = await supabase.from('message_templates').select('*').eq('type', type).eq('is_active', true).limit(1);
      result = (data?.[0] as MessageTemplate) || null;
    } else {
      const res = await api.getMessageTemplates();
      if (!res.success || !res.data) return null;
      // MariaDB may return is_active as 1/0 instead of true/false
      result = res.data.find(t => t.type === type && (t.is_active === true || t.is_active === 1 || t.is_active === '1')) || null;
    }
    addOperationLog(backend, 'Templates', 'SELECT', `Buscou template tipo ${type}${result ? ` (id=${result.id})` : ' (não encontrado)'}`);
    return result;
  } catch (err: any) {
    addOperationLog(backend, 'Templates', 'SELECT', `Erro ao buscar template tipo ${type}`, 'error', err?.message);
    return null;
  }
}

export function replaceTemplateVars(content: string, vars: Record<string, string>): string {
  let msg = content;
  for (const [key, value] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return msg;
}

export async function updateMessageTemplate(id: number, template: Partial<MessageTemplate>): Promise<void> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    if (isLovableEnv()) {
      const { error } = await supabase.from('message_templates').update({ content: template.content, is_active: template.is_active, name: template.name }).eq('id', id);
      if (error) throw error;
    } else {
      const res = await api.updateMessageTemplate(id, template);
      if (!res.success) throw new Error(res.error || 'Erro ao atualizar template');
    }
    addOperationLog(backend, 'Templates', 'UPDATE', `Atualizou template #${id}`);
  } catch (err: any) {
    addOperationLog(backend, 'Templates', 'UPDATE', `Erro ao atualizar template #${id}`, 'error', err?.message);
    throw err;
  }
}

// ===== DASHBOARD =====

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    let stats: DashboardStats;
    if (isLovableEnv()) {
      let query = supabase.from('clients').select('*');
      if (!isAdmin()) {
        query = query.eq('owner_id', getCurrentOwnerId());
      }
      const { data: clients, error } = await query;
      if (error) throw error;
      const allClients = clients || [];
      const activeClients = allClients.filter((c: any) => c.is_active);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      let overdueCount = 0, totalOverdue = 0, pendingCount = 0, totalPending = 0;
      allClients.forEach((c: any) => {
        if (!c.due_date || !c.amount) return;
        const due = new Date(c.due_date + 'T00:00:00');
        if (due < today) { overdueCount++; totalOverdue += Number(c.amount); }
        else { pendingCount++; totalPending += Number(c.amount); }
      });
      const totalRevenue = allClients.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
      stats = { total_clients: allClients.length, active_clients: activeClients.length, total_revenue_month: totalRevenue, total_pending: totalPending, total_overdue: totalOverdue, overdue_count: overdueCount, paid_count: 0, pending_count: pendingCount, revenue_by_month: [], status_distribution: [{ status: 'Pendente', count: pendingCount }, { status: 'Atrasado', count: overdueCount }] };
    } else {
      const res = await api.getDashboardStats();
      if (!res.success || !res.data) throw new Error(res.error || 'Erro ao buscar stats');
      stats = res.data;
    }
    addOperationLog(backend, 'Dashboard', 'SELECT', `Carregou stats: ${stats.total_clients} clientes`);
    return stats;
  } catch (err: any) {
    addOperationLog(backend, 'Dashboard', 'SELECT', 'Erro ao carregar stats', 'error', err?.message);
    throw err;
  }
}

// ===== FILA DE COBRANÇA =====

export interface QueueItem {
  id: number;
  client_id: number;
  client_name: string;
  client_phone: string;
  type: string;
  amount: number;
  due_date: string;
  days_overdue: number;
  status: string;
  message?: string;
  created_at?: string;
  sent_at?: string;
}

export async function fetchQueue(): Promise<QueueItem[]> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    let result: QueueItem[];
    if (isLovableEnv()) {
      let query = supabase.from('billing_queue').select('*').order('created_at', { ascending: false });
      if (!isAdmin()) {
        query = query.eq('owner_id', getCurrentOwnerId());
      }
      const { data, error } = await query;
      if (error) throw error;
      result = (data || []) as QueueItem[];
    } else {
      const res = await apiFetch('/queue');
      const json = await safeJsonParse(res);
      if (!json.success) throw new Error(json.error || 'Erro ao buscar fila');
      result = json.data || [];
    }
    addOperationLog(backend, 'Fila', 'SELECT', `Listou ${result.length} itens na fila`);
    return result;
  } catch (err: any) {
    addOperationLog(backend, 'Fila', 'SELECT', 'Erro ao listar fila', 'error', err?.message);
    throw err;
  }
}

export async function clearQueue(): Promise<void> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    if (isLovableEnv()) {
      const { error } = await supabase.from('billing_queue').delete().gte('id', 0);
      if (error) throw error;
    } else {
      const res = await apiFetch('/queue', { method: 'DELETE' });
      const json = await safeJsonParse(res);
      if (!json.success) throw new Error(json.error || 'Erro ao limpar fila');
    }
    addOperationLog(backend, 'Fila', 'DELETE', 'Limpou toda a fila');
  } catch (err: any) {
    addOperationLog(backend, 'Fila', 'DELETE', 'Erro ao limpar fila', 'error', err?.message);
    throw err;
  }
}

export async function updateQueueItemStatus(id: number, status: string): Promise<void> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    if (isLovableEnv()) {
      const update: any = { status };
      if (status === 'sent') update.sent_at = new Date().toISOString();
      const { error } = await supabase.from('billing_queue').update(update).eq('id', id);
      if (error) throw error;
    } else {
      await apiFetch(`/queue/${id}`, { method: 'PATCH', body: JSON.stringify({ status, sent_at: status === 'sent' ? new Date().toISOString() : null }) });
    }
    addOperationLog(backend, 'Fila', 'UPDATE', `Atualizou item #${id} para "${status}"`);
  } catch (err: any) {
    addOperationLog(backend, 'Fila', 'UPDATE', `Erro ao atualizar item #${id}`, 'error', err?.message);
    throw err;
  }
}

// ===== CONFIGURAÇÕES =====

export interface BillingSettings {
  reminder_days: string;
  send_time_reminder: string;
  send_time_due: string;
  send_time_overdue: string;
  overdue_frequency: string;
  [key: string]: string;
}

export async function fetchSettings(): Promise<BillingSettings> {
  const backend = ACTIVE_DATA_BACKEND;
  const defaults: BillingSettings = { reminder_days: '3', send_time_reminder: '08:00', send_time_due: '08:00', send_time_overdue: '09:00', overdue_frequency: '3' };
  try {
    if (isLovableEnv()) {
      const settings = { ...defaults };

      for (const key of Object.keys(defaults)) {
        const storedValue = userStorageGet(`billing_setting_${key}`);
        if (storedValue !== null) {
          settings[key] = storedValue;
        }
      }

      addOperationLog(backend, 'Config', 'SELECT', 'Carregou configurações isoladas por usuário');
      return settings;
    } else {
      const res = await apiFetch('/settings');
      const json = await safeJsonParse(res);
      if (!json.success) return defaults;
      addOperationLog(backend, 'Config', 'SELECT', 'Carregou configurações');
      return { ...defaults, ...json.data };
    }
  } catch (err: any) {
    addOperationLog(backend, 'Config', 'SELECT', 'Erro ao carregar configurações', 'error', err?.message);
    return defaults;
  }
}

export async function saveSettings(settings: Partial<BillingSettings>): Promise<void> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    if (isLovableEnv()) {
      for (const [key, value] of Object.entries(settings)) {
        userStorageSet(`billing_setting_${key}`, String(value));
      }
    } else {
      await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(settings) });
    }
    addOperationLog(backend, 'Config', 'UPDATE', `Salvou ${Object.keys(settings).length} configurações`);
  } catch (err: any) {
    addOperationLog(backend, 'Config', 'UPDATE', 'Erro ao salvar configurações', 'error', err?.message);
    throw err;
  }
}

// ===== WHATSAPP (Evolution API) =====

interface EvolutionPayload {
  action: 'create' | 'status' | 'send-text';
  api_url: string;
  api_key: string;
  instance_name: string;
  to?: string;
  message?: string;
}

export async function invokeEvolutionProxy(payload: EvolutionPayload): Promise<{ data?: any; error?: string }> {
  const backend = ACTIVE_DATA_BACKEND;
  if (isLovableEnv()) {
    const { data, error } = await supabase.functions.invoke('evolution-proxy', { body: payload });
    if (error) {
      addOperationLog(backend, 'WhatsApp', payload.action, `Erro: ${error.message}`, 'error', error.message);
      return { error: error.message || 'Erro na Edge Function' };
    }
    addOperationLog(backend, 'WhatsApp', payload.action, `Ação "${payload.action}" executada`);
    return { data };
  } else {
    try {
      const res = await apiFetch('/whatsapp', { method: 'POST', body: JSON.stringify(payload) });
      const data = await safeJsonParse(res);
      if (!res.ok) {
        let debugMessage = data?.debug?.response?.message?.[0] || data?.debug?.error || data?.debug?.message;
        if (debugMessage && typeof debugMessage === 'object') debugMessage = JSON.stringify(debugMessage);
        let mainError = data?.error;
        if (mainError && typeof mainError === 'object') mainError = JSON.stringify(mainError);
        const errorMessage = [mainError, debugMessage].filter(Boolean).join(' - ');
        addOperationLog(backend, 'WhatsApp', payload.action, `Erro: ${errorMessage}`, 'error', errorMessage);
        return { error: errorMessage || `Erro ${res.status}` };
      }
      addOperationLog(backend, 'WhatsApp', payload.action, `Ação "${payload.action}" executada`);
      return { data };
    } catch (err: any) {
      addOperationLog(backend, 'WhatsApp', payload.action, `Erro de conexão`, 'error', err?.message);
      return { error: err?.message || 'Erro de conexão com o servidor' };
    }
  }
}

// ===== CONTAS A PAGAR =====

export interface BillPayable {
  id: number;
  description: string;
  supplier: string | null;
  category: string | null;
  payment_type: string;
  total_amount: number;
  installments_count: number;
  current_installment: number;
  parent_bill_id: number | null;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export async function fetchBills(): Promise<BillPayable[]> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    let result: BillPayable[];
    if (isLovableEnv()) {
      let query = supabase.from('bills_payable').select('*').is('parent_bill_id', null).order('due_date', { ascending: true });
      if (!isAdmin()) {
        query = query.eq('owner_id', getCurrentOwnerId());
      }
      const { data, error } = await query;
      if (error) throw error;
      result = (data as unknown as BillPayable[]) || [];
    } else {
      const res = await api.getBills();
      if (!res.success) throw new Error(res.error || 'Erro ao buscar contas');
      const payload = res.data as any;
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      result = rows as BillPayable[];
    }
    addOperationLog(backend, 'Financeiro', 'SELECT', `Listou ${result.length} contas`);
    return result;
  } catch (err: any) {
    addOperationLog(backend, 'Financeiro', 'SELECT', 'Erro ao listar contas', 'error', err?.message);
    throw err;
  }
}

export async function createBill(bill: Partial<BillPayable>): Promise<BillPayable | null> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    let result: BillPayable | null;
    if (isLovableEnv()) {
      const { data, error } = await supabase.from('bills_payable').insert({ ...bill, owner_id: getCurrentOwnerId() } as any).select().single();
      if (error) throw error;
      result = data as unknown as BillPayable;
    } else {
      const res = await api.createBill(bill as any);
      if (!res.success) throw new Error(res.error || 'Erro ao criar conta');
      const payload = res.data as any;
      result = (payload?.data ?? payload ?? null) as BillPayable | null;
    }
    addOperationLog(backend, 'Financeiro', 'INSERT', `Criou conta "${bill.description}"`);
    return result;
  } catch (err: any) {
    addOperationLog(backend, 'Financeiro', 'INSERT', `Erro ao criar "${bill.description}"`, 'error', err?.message);
    throw err;
  }
}

export async function createBillChildren(children: Partial<BillPayable>[]): Promise<void> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    if (isLovableEnv()) {
      const { error } = await supabase.from('bills_payable').insert(children as any);
      if (error) throw error;
    } else {
      const res = await api.createBillsBatch(children as any);
      if (!res.success) throw new Error(res.error || 'Erro ao criar parcelas');
    }
    addOperationLog(backend, 'Financeiro', 'INSERT', `Criou ${children.length} parcelas filhas`);
  } catch (err: any) {
    addOperationLog(backend, 'Financeiro', 'INSERT', `Erro ao criar parcelas`, 'error', err?.message);
    throw err;
  }
}

export async function updateBill(id: number, bill: Partial<BillPayable>): Promise<void> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    if (isLovableEnv()) {
      const { error } = await supabase.from('bills_payable').update({ ...bill, updated_at: new Date().toISOString() } as any).eq('id', id);
      if (error) throw error;
    } else {
      const res = await api.updateBill(id, bill as any);
      if (!res.success) throw new Error(res.error || 'Erro ao atualizar conta');
    }
    addOperationLog(backend, 'Financeiro', 'UPDATE', `Atualizou conta #${id}`);
  } catch (err: any) {
    addOperationLog(backend, 'Financeiro', 'UPDATE', `Erro ao atualizar #${id}`, 'error', err?.message);
    throw err;
  }
}

export async function deleteBill(id: number): Promise<void> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    if (isLovableEnv()) {
      const { error } = await supabase.from('bills_payable').delete().eq('id', id);
      if (error) throw error;
    } else {
      const res = await api.deleteBill(id);
      if (!res.success) throw new Error(res.error || 'Erro ao excluir conta');
    }
    addOperationLog(backend, 'Financeiro', 'DELETE', `Excluiu conta #${id}`);
  } catch (err: any) {
    addOperationLog(backend, 'Financeiro', 'DELETE', `Erro ao excluir #${id}`, 'error', err?.message);
    throw err;
  }
}

export async function markBillPaid(id: number): Promise<void> {
  const backend = ACTIVE_DATA_BACKEND;
  try {
    if (isLovableEnv()) {
      const { error } = await supabase.from('bills_payable').update({ status: 'paid', paid_date: formatLocalDate(new Date()) } as any).eq('id', id);
      if (error) throw error;
    } else {
      const res = await api.markBillPaid(id);
      if (!res.success) throw new Error(res.error || 'Erro ao marcar como paga');
    }
    addOperationLog(backend, 'Financeiro', 'UPDATE', `Marcou conta #${id} como paga`);
  } catch (err: any) {
    addOperationLog(backend, 'Financeiro', 'UPDATE', `Erro ao marcar #${id} como paga`, 'error', err?.message);
    throw err;
  }
}

export function getActiveDataBackend(): DataBackend {
  return ACTIVE_DATA_BACKEND;
}
