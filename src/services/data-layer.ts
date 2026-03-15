// ===== CAMADA DE DADOS UNIFICADA =====
// Detecta automaticamente o ambiente:
// - Lovable (preview/teste): usa Supabase (Lovable Cloud)
// - VPS (produção): usa API REST + MariaDB

import { supabase } from '@/integrations/supabase/client';
import api from '@/services/api';
import type { Client, MessageTemplate, DashboardStats } from '@/types/billing';

// Detecta se está rodando no ambiente Lovable (preview) ou na VPS
const isLovableEnv = () => {
  const hostname = window.location.hostname;
  return hostname.includes('lovable.app') || hostname.includes('lovableproject.com') || hostname === 'localhost';
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
