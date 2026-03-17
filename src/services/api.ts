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
const RETRIABLE_PROXY_ERROR = /\b(502|503|504)\b|bad gateway|gateway timeout/i;

class ApiService {
  private baseUrl: string;
  private token: string | null = null;
  private traccarGetCache = new Map<string, { expiresAt: number; result: ApiResponse<any> }>();
  private traccarInFlight = new Map<string, Promise<ApiResponse<any>>>();

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

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRetriableProxyError(message?: string) {
    return RETRIABLE_PROXY_ERROR.test(message || '');
  }

  private getTraccarCacheTtl(endpoint = '', method = 'GET') {
    if (method !== 'GET') return 0;
    if (endpoint.startsWith('/api/positions')) return 2500;
    if (endpoint.startsWith('/api/devices?id=')) return 4000;
    if (endpoint.startsWith('/api/devices')) return 15000;
    return 0;
  }

  private getTraccarCacheKey(params: { traccar_url: string; traccar_user: string; endpoint?: string; method?: string; body?: any }) {
    return JSON.stringify({
      traccar_url: params.traccar_url,
      traccar_user: params.traccar_user,
      endpoint: params.endpoint || '/api/users',
      method: params.method || 'GET',
      body: (params.method || 'GET') === 'GET' ? undefined : params.body,
    });
  }

  private async performTraccarProxyRequest(params: { traccar_url: string; traccar_user: string; traccar_password: string; endpoint?: string; method?: string; body?: any }) {
    const requestOptions = {
      method: 'POST',
      body: JSON.stringify(params),
    } satisfies RequestInit;

    const firstAttempt = await this.request<{ data: any }>('/traccar/proxy', requestOptions);
    if (firstAttempt.success || !this.isRetriableProxyError(firstAttempt.error)) {
      return firstAttempt;
    }

    await this.sleep(700);
    return this.request<{ data: any }>('/traccar/proxy', requestOptions);
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

  async getMessageTemplateByType(type: string, activeOnly = false) {
    const query = activeOnly ? '?active=true' : '';
    return this.request<MessageTemplate>(`/templates/messages/by-type/${encodeURIComponent(type)}${query}`);
  }

  async updateMessageTemplate(id: number, template: Partial<MessageTemplate>) {
    return this.request<MessageTemplate>(`/templates/messages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    });
  }

  async updateMessageTemplateByType(type: MessageTemplate['type'], template: Partial<MessageTemplate>) {
    return this.request<MessageTemplate>(`/templates/messages/by-type/${type}`, {
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

  // ===== TRACCAR =====
  async traccarProxy(params: { traccar_url: string; traccar_user: string; traccar_password: string; endpoint?: string; method?: string; body?: any }) {
    const directResult = await this.request<{ data: any }>('/traccar/proxy', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (directResult.success) {
      return directResult;
    }

    console.warn('[api.traccarProxy] Falling back to Lovable Cloud proxy:', directResult.error);

    const { data, error } = await supabase.functions.invoke('traccar-proxy', {
      body: params,
    });

    if (error) {
      return {
        success: false,
        error: directResult.error || error.message || 'Erro ao consultar Traccar',
      };
    }

    return {
      success: true,
      data: data as any,
    };
  }

  // Buscar eventos ignitionOff em lote (com cache server-side de 5 min)
  async getIgnitionOffEvents(params: { traccar_url: string; traccar_user: string; traccar_password: string }) {
    const directResult = await this.request<{ data: Record<string, string>; cached?: boolean }>('/traccar/ignition-events', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (directResult.success) {
      return directResult;
    }

    // Fallback: sem endpoint VPS, retorna vazio
    console.warn('[api.getIgnitionOffEvents] Failed:', directResult.error);
    return { success: false, error: directResult.error, data: undefined };
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
