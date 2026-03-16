// ===== CAMADA DE SERVIÇO API REST =====
// Configurável para apontar ao backend na VPS com MariaDB
// Em dev usa dados mock; em prod aponta para a API real

import type {
  ApiResponse,
  PaginatedResponse,
  Client,
  BillingConfig,
  BillingQueue,
  BillPayable,
  PaymentLink,
  MessageTemplate,
  ContractTemplate,
  Contract,
  WhatsAppConfig,
  PaymentGatewayConfig,
  DashboardStats,
} from '@/types/billing';

// Base URL configurável - prioriza URL salva da VPS no navegador
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('auth_token');
  }

  private needsProxy(): boolean {
    if (typeof window === 'undefined') return false;
    const isHttps = window.location.protocol === 'https:';
    const vpsUrl = this.resolveBaseUrl();
    return isHttps && vpsUrl.startsWith('http://');
  }

  private getProxyBaseUrl(): string {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'pmnanfzbtimcfyzndeyq';
    return `https://${projectId}.supabase.co/functions/v1/vps-proxy`;
  }

  private resolveBaseUrl(): string {
    if (typeof window !== 'undefined') {
      const storedBaseUrl = window.localStorage.getItem('api_base_url')?.trim();
      if (storedBaseUrl) return storedBaseUrl;
    }

    return this.baseUrl;
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Send owner ID for tenant isolation on VPS
    try {
      const { getCurrentOwnerId } = await import('@/services/auth');
      const ownerId = getCurrentOwnerId();
      if (ownerId) {
        headers['X-Owner-Id'] = ownerId;
      }
    } catch { /* ignore */ }

    try {
      let fetchUrl: string;
      const fetchHeaders = { ...headers };

      if (this.needsProxy()) {
        const vpsUrl = this.resolveBaseUrl();
        fetchUrl = `${this.getProxyBaseUrl()}?vps_url=${encodeURIComponent(vpsUrl)}&endpoint=${encodeURIComponent(endpoint)}`;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
        fetchHeaders['apikey'] = anonKey;
      } else {
        fetchUrl = `${this.resolveBaseUrl()}${endpoint}`;
      }

      const response = await fetch(fetchUrl, {
        ...options,
        headers: fetchHeaders,
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Erro ${response.status}`;

        if (contentType.includes('application/json')) {
          const error = await response.json().catch(() => null);
          errorMessage = error?.message || error?.error || errorMessage;
        } else {
          const raw = await response.text().catch(() => '');
          const clean = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          errorMessage = clean
            ? `${errorMessage}: ${clean.slice(0, 140)}`
            : `${errorMessage} ${response.statusText}`.trim();
        }

        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      return { success: false, error: `Erro de conexão com o servidor: ${message}` };
    }
  }

  // ===== AUTH =====
  async login(email: string, password: string) {
    return this.request<{ token: string; user: { id: string; name: string; email: string; role: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(name: string, email: string, password: string) {
    return this.request<{ user: { id: string; name: string; email: string; role: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  }

  async getUsers() {
    return this.request<{ id: string; name: string; email: string; role: string; createdAt: string }[]>('/auth/users');
  }

  async deleteUser(id: string) {
    return this.request<void>(`/auth/users/${id}`, { method: 'DELETE' });
  }

  // ===== CLIENTES =====
  async getClients(page = 1, search = '') {
    return this.request<PaginatedResponse<Client>>(`/clients?page=${page}&search=${encodeURIComponent(search)}`);
  }

  async getClient(id: number) {
    return this.request<Client>(`/clients/${id}`);
  }

  async createClient(client: Partial<Client>) {
    return this.request<Client>('/clients', { method: 'POST', body: JSON.stringify(client) });
  }

  async updateClient(id: number, client: Partial<Client>) {
    return this.request<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(client) });
  }

  async deleteClient(id: number) {
    return this.request<void>(`/clients/${id}`, { method: 'DELETE' });
  }

  // ===== CONTAS A PAGAR =====
  async getBills() {
    return this.request<BillPayable[]>('/bills');
  }

  async createBill(bill: Partial<BillPayable>) {
    return this.request<BillPayable>('/bills', { method: 'POST', body: JSON.stringify(bill) });
  }

  async createBillsBatch(bills: Partial<BillPayable>[]) {
    return this.request<void>('/bills/batch', { method: 'POST', body: JSON.stringify({ bills }) });
  }

  async updateBill(id: number, bill: Partial<BillPayable>) {
    return this.request<BillPayable>(`/bills/${id}`, { method: 'PUT', body: JSON.stringify(bill) });
  }

  async deleteBill(id: number) {
    return this.request<void>(`/bills/${id}`, { method: 'DELETE' });
  }

  async markBillPaid(id: number) {
    return this.request<void>(`/bills/${id}/pay`, { method: 'PATCH' });
  }

  // ===== COBRANÇA =====
  async getBillingConfigs(clientId?: number) {
    const query = clientId ? `?client_id=${clientId}` : '';
    return this.request<BillingConfig[]>(`/billing/configs${query}`);
  }

  async createBillingConfig(config: Partial<BillingConfig>) {
    return this.request<BillingConfig>('/billing/configs', { method: 'POST', body: JSON.stringify(config) });
  }

  async updateBillingConfig(id: number, config: Partial<BillingConfig>) {
    return this.request<BillingConfig>(`/billing/configs/${id}`, { method: 'PUT', body: JSON.stringify(config) });
  }

  // ===== FILA DE COBRANÇA =====
  async getBillingQueue(status?: string) {
    const query = status ? `?status=${status}` : '';
    return this.request<BillingQueue[]>(`/billing/queue${query}`);
  }

  async processQueue() {
    return this.request<{ processed: number }>('/billing/queue/process', { method: 'POST' });
  }

  async populateQueue() {
    return this.request<{ added: number }>('/billing/queue/populate', { method: 'POST' });
  }

  // ===== PAGAMENTOS =====
  async generatePaymentLink(clientId: number, amount: number, description: string) {
    return this.request<PaymentLink>('/payments/generate', {
      method: 'POST',
      body: JSON.stringify({ client_id: clientId, amount, description }),
    });
  }

  async getPaymentLinks(clientId?: number) {
    const query = clientId ? `?client_id=${clientId}` : '';
    return this.request<PaymentLink[]>(`/payments${query}`);
  }

  // ===== TEMPLATES DE MENSAGEM =====
  async getMessageTemplates() {
    return this.request<MessageTemplate[]>('/templates/messages');
  }

  async updateMessageTemplate(id: number, template: Partial<MessageTemplate>) {
    return this.request<MessageTemplate>(`/templates/messages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    });
  }

  // ===== CONTRATOS =====
  async getContractTemplates() {
    return this.request<ContractTemplate[]>('/contracts/templates');
  }

  async createContractTemplate(template: Partial<ContractTemplate>) {
    return this.request<ContractTemplate>('/contracts/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }

  async getContracts(clientId?: number) {
    const query = clientId ? `?client_id=${clientId}` : '';
    return this.request<Contract[]>(`/contracts${query}`);
  }

  async sendContract(clientId: number, templateId: number) {
    return this.request<Contract>('/contracts/send', {
      method: 'POST',
      body: JSON.stringify({ client_id: clientId, template_id: templateId }),
    });
  }

  // ===== CONFIGURAÇÕES =====
  async getWhatsAppConfig() {
    return this.request<WhatsAppConfig>('/config/whatsapp');
  }

  async updateWhatsAppConfig(config: Partial<WhatsAppConfig>) {
    return this.request<WhatsAppConfig>('/config/whatsapp', { method: 'PUT', body: JSON.stringify(config) });
  }

  async getPaymentConfig() {
    return this.request<PaymentGatewayConfig>('/config/payment');
  }

  async updatePaymentConfig(config: Partial<PaymentGatewayConfig>) {
    return this.request<PaymentGatewayConfig>('/config/payment', { method: 'PUT', body: JSON.stringify(config) });
  }

  // ===== DASHBOARD =====
  async getDashboardStats() {
    return this.request<DashboardStats>('/dashboard/stats');
  }
}

export const api = new ApiService(API_BASE_URL);
export default api;
