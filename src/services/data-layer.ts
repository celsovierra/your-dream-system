// ===== CAMADA DE DADOS UNIFICADA =====
// Detecta automaticamente o ambiente:
// - Lovable (preview/teste): usa Supabase (Lovable Cloud)
// - VPS (produção): usa API REST + MariaDB

import { supabase } from '@/integrations/supabase/client';
import api from '@/services/api';
import type { Client, MessageTemplate, DashboardStats } from '@/types/billing';

// Detecta se está rodando no ambiente de teste (Lovable Cloud) ou na VPS
// Regra de isolamento:
// - preview/publish do Lovable => Lovable Cloud
// - localhost/VPS/domínio próprio => API REST (MariaDB)
const isLovableEnv = () => {
  const forcedBackend = String(import.meta.env.VITE_DATA_BACKEND || '').toLowerCase();
  if (forcedBackend === 'cloud') return true;
  if (forcedBackend === 'api') return false;

  const hostname = window.location.hostname.toLowerCase();
  return hostname.endsWith('.lovable.app') || hostname.endsWith('.lovableproject.com');
};

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
  if (isLovableEnv()) {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    if (error) throw error;
    return (data || []).map((c: any) => ({
      ...c,
      due_date: normalizeDateOnly(c.due_date),
      amount: c.amount ? Number(c.amount) : undefined,
    }));
  } else {
    const res = await api.getClients();
    if (!res.success || !res.data) throw new Error(res.error || 'Erro ao buscar clientes');
    return (res.data.data || []).map((c: any) => ({
      ...c,
      due_date: normalizeDateOnly(c.due_date),
      amount: c.amount ? Number(c.amount) : undefined,
    }));
  }
}

export async function createClient(client: Partial<Client>): Promise<void> {
  if (isLovableEnv()) {
    const { error } = await supabase.from('clients').insert({
      name: client.name,
      email: client.email || null,
      phone: client.phone,
      phone2: client.phone2 || null,
      document: client.document || null,
      amount: client.amount || null,
      due_date: client.due_date || null,
    });
    if (error) throw error;
  } else {
    const res = await api.createClient(client);
    if (!res.success) throw new Error(res.error || 'Erro ao criar cliente');
  }
}

export async function updateClient(id: number, client: Partial<Client>): Promise<void> {
  if (isLovableEnv()) {
    const { error } = await supabase
      .from('clients')
      .update({ ...client, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  } else {
    const res = await api.updateClient(id, client);
    if (!res.success) throw new Error(res.error || 'Erro ao atualizar cliente');
  }
}

export async function deleteClient(id: number): Promise<void> {
  if (isLovableEnv()) {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
  } else {
    const res = await api.deleteClient(id);
    if (!res.success) throw new Error(res.error || 'Erro ao remover cliente');
  }
}

// ===== TEMPLATES DE MENSAGEM =====

export async function fetchMessageTemplates(): Promise<MessageTemplate[]> {
  if (isLovableEnv()) {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .order('id');
    if (error) throw error;
    return (data || []) as MessageTemplate[];
  } else {
    const res = await api.getMessageTemplates();
    if (!res.success || !res.data) throw new Error(res.error || 'Erro ao buscar templates');
    return res.data;
  }
}

export async function getReceiptTemplate(): Promise<MessageTemplate | null> {
  if (isLovableEnv()) {
    const { data } = await supabase
      .from('message_templates')
      .select('*')
      .eq('type', 'receipt')
      .eq('is_active', true)
      .limit(1);
    return (data?.[0] as MessageTemplate) || null;
  } else {
    const res = await api.getMessageTemplates();
    if (!res.success || !res.data) return null;
    return res.data.find(t => t.type === 'receipt' && t.is_active) || null;
  }
}

// ===== DASHBOARD =====

export async function fetchDashboardStats(): Promise<DashboardStats> {
  if (isLovableEnv()) {
    const { data: clients, error } = await supabase.from('clients').select('*');
    if (error) throw error;

    const allClients = clients || [];
    const activeClients = allClients.filter((c: any) => c.is_active);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let overdueCount = 0, totalOverdue = 0, pendingCount = 0, totalPending = 0;

    allClients.forEach((c: any) => {
      if (!c.due_date || !c.amount) return;
      const due = new Date(c.due_date + 'T00:00:00');
      if (due < today) {
        overdueCount++;
        totalOverdue += Number(c.amount);
      } else {
        pendingCount++;
        totalPending += Number(c.amount);
      }
    });

    const totalRevenue = allClients.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);

    return {
      total_clients: allClients.length,
      active_clients: activeClients.length,
      total_revenue_month: totalRevenue,
      total_pending: totalPending,
      total_overdue: totalOverdue,
      overdue_count: overdueCount,
      paid_count: 0,
      pending_count: pendingCount,
      revenue_by_month: [],
      status_distribution: [
        { status: 'Pendente', count: pendingCount },
        { status: 'Atrasado', count: overdueCount },
      ],
    };
  } else {
    const res = await api.getDashboardStats();
    if (!res.success || !res.data) throw new Error(res.error || 'Erro ao buscar stats');
    return res.data;
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
  if (isLovableEnv()) {
    const { data, error } = await supabase
      .from('billing_queue')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as QueueItem[];
  } else {
    const res = await fetch('/api/queue');
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erro ao buscar fila');
    return json.data || [];
  }
}

export async function clearQueue(): Promise<void> {
  if (isLovableEnv()) {
    const { error } = await supabase.from('billing_queue').delete().gte('id', 0);
    if (error) throw error;
  } else {
    const res = await fetch('/api/queue', { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erro ao limpar fila');
  }
}

export async function updateQueueItemStatus(id: number, status: string): Promise<void> {
  if (isLovableEnv()) {
    const update: any = { status };
    if (status === 'sent') update.sent_at = new Date().toISOString();
    const { error } = await supabase.from('billing_queue').update(update).eq('id', id);
    if (error) throw error;
  } else {
    await fetch(`/api/queue/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, sent_at: status === 'sent' ? new Date().toISOString() : null }),
    });
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
  const defaults: BillingSettings = {
    reminder_days: '3',
    send_time_reminder: '08:00',
    send_time_due: '08:00',
    send_time_overdue: '09:00',
    overdue_frequency: '3',
  };

  if (isLovableEnv()) {
    const { data, error } = await supabase.from('billing_settings').select('*');
    if (error) return defaults;
    const settings = { ...defaults };
    (data || []).forEach((row: any) => { settings[row.key] = row.value; });
    return settings;
  } else {
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (!json.success) return defaults;
      return { ...defaults, ...json.data };
    } catch {
      return defaults;
    }
  }
}

export async function saveSettings(settings: Partial<BillingSettings>): Promise<void> {
  if (isLovableEnv()) {
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from('billing_settings').upsert({ key, value: String(value), updated_at: new Date().toISOString() });
    }
  } else {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
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
  if (isLovableEnv()) {
    const { data, error } = await supabase.functions.invoke('evolution-proxy', { body: payload });
    if (error) return { error: error.message || 'Erro na Edge Function' };
    return { data };
  } else {
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        let debugMessage = data?.debug?.response?.message?.[0] || data?.debug?.error || data?.debug?.message;
        if (debugMessage && typeof debugMessage === 'object') debugMessage = JSON.stringify(debugMessage);
        let mainError = data?.error;
        if (mainError && typeof mainError === 'object') mainError = JSON.stringify(mainError);
        const errorMessage = [mainError, debugMessage].filter(Boolean).join(' - ');
        return { error: errorMessage || `Erro ${res.status}` };
      }
      return { data };
    } catch (err: any) {
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
  if (isLovableEnv()) {
    const { data, error } = await supabase
      .from('bills_payable')
      .select('*')
      .is('parent_bill_id', null)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return (data as unknown as BillPayable[]) || [];
  } else {
    const res = await fetch('/api/bills');
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erro ao buscar contas');
    return json.data || [];
  }
}

export async function createBill(bill: Partial<BillPayable>): Promise<BillPayable | null> {
  if (isLovableEnv()) {
    const { data, error } = await supabase
      .from('bills_payable')
      .insert(bill as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as BillPayable;
  } else {
    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bill),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erro ao criar conta');
    return json.data || null;
  }
}

export async function createBillChildren(children: Partial<BillPayable>[]): Promise<void> {
  if (isLovableEnv()) {
    const { error } = await supabase.from('bills_payable').insert(children as any);
    if (error) throw error;
  } else {
    await fetch('/api/bills/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bills: children }),
    });
  }
}

export async function updateBill(id: number, bill: Partial<BillPayable>): Promise<void> {
  if (isLovableEnv()) {
    const { error } = await supabase
      .from('bills_payable')
      .update({ ...bill, updated_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) throw error;
  } else {
    const res = await fetch(`/api/bills/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bill),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erro ao atualizar conta');
  }
}

export async function deleteBill(id: number): Promise<void> {
  if (isLovableEnv()) {
    const { error } = await supabase.from('bills_payable').delete().eq('id', id);
    if (error) throw error;
  } else {
    const res = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erro ao excluir conta');
  }
}

export async function markBillPaid(id: number): Promise<void> {
  if (isLovableEnv()) {
    const { error } = await supabase
      .from('bills_payable')
      .update({ status: 'paid', paid_date: formatLocalDate(new Date()) } as any)
      .eq('id', id);
    if (error) throw error;
  } else {
    const res = await fetch(`/api/bills/${id}/pay`, { method: 'PATCH' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erro ao marcar como paga');
  }
}
