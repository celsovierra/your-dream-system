// ===== TIPOS DO SISTEMA DE COBRANÇA =====
// Preparado para API REST com MariaDB na VPS

export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  phone2?: string;
  document: string; // CPF/CNPJ
  amount?: number;
  due_date?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingConfig {
  id: number;
  client_id: number;
  due_day: number;
  amount: number;
  discount?: number;
  description: string;
  is_active: boolean;
  next_due_date: string;
  created_at: string;
}

export interface BillingQueue {
  id: number;
  client_id: number;
  client_name: string;
  client_phone: string;
  message_type: 'reminder' | 'due' | 'overdue' | 'receipt' | 'blocked';
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  days_overdue: number;
  amount: number;
  due_date: string;
  sent_at?: string;
  error_message?: string;
  created_at: string;
}

export interface BillPayable {
  id: number;
  description: string;
  supplier: string | null;
  category: string | null;
  payment_type: 'single' | 'installment';
  total_amount: number;
  installments_count: number;
  current_installment: number;
  parent_bill_id: number | null;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentLink {
  id: number;
  client_id: number;
  amount: number;
  description: string;
  payment_url?: string;
  qr_code?: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  paid_at?: string;
  expires_at: string;
  created_at: string;
}

export interface MessageTemplate {
  id: number;
  name: string;
  type: 'reminder' | 'due' | 'overdue' | 'receipt' | 'blocked';
  content: string;
  is_active: boolean;
  created_at: string;
}

export interface ContractTemplate {
  id: number;
  name: string;
  content: string;
  is_default: boolean;
  created_at: string;
}

export interface Contract {
  id: number;
  client_id: number;
  client_name: string;
  template_id: number;
  status: 'draft' | 'sent' | 'signed' | 'cancelled';
  signed_at?: string;
  signature_data?: string;
  invite_token?: string;
  created_at: string;
}

export interface WhatsAppConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  status: 'connected' | 'disconnected' | 'connecting';
}

export interface PaymentGatewayConfig {
  gateway: 'mercadopago' | 'pix_manual';
  access_token: string;
  webhook_url?: string;
}

export interface DashboardStats {
  total_clients: number;
  active_clients: number;
  total_revenue_month: number;
  total_pending: number;
  total_overdue: number;
  overdue_count: number;
  paid_count: number;
  pending_count: number;
  revenue_by_month: { month: string; amount: number }[];
  status_distribution: { status: string; count: number }[];
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
