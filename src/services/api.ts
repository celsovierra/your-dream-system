// ===== CAMADA DE SERVIÇO API REST =====
// Configurável para apontar ao backend na VPS com MariaDB
// Em dev usa dados mock; em prod aponta para a API real

import type {
  ApiResponse,
  PaginatedResponse,
  Client,
  BillingConfig,
  BillingQueue,
  PaymentLink,
  MessageTemplate,
  ContractTemplate,
  Contract,
  WhatsAppConfig,
  PaymentGatewayConfig,
  DashboardStats,
} from '@/types/billing';

// Base URL configurável - altere para o endereço da sua VPS
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('auth_token');
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

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        return { success: false, error: error.message || `Erro ${response.status}` };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: 'Erro de conexão com o servidor' };
    }
  }

  // ===== AUTH =====
  async login(email: string, password: string) {
    return this.request<{ token: string; user: { id: number; name: string; email: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
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
