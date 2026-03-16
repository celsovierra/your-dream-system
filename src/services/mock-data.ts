// ===== DADOS MOCK PARA DESENVOLVIMENTO =====
import type { Client, BillingQueue, DashboardStats, MessageTemplate, ContractTemplate } from '@/types/billing';

export const mockClients: Client[] = [
  { id: 1, name: 'João Silva', email: 'joao@email.com', phone: '11999990001', document: '123.456.789-00', amount: 150, due_date: '2024-03-20', is_active: true, created_at: '2024-01-15', updated_at: '2024-01-15' },
  { id: 2, name: 'Maria Santos', email: 'maria@email.com', phone: '11999990002', document: '987.654.321-00', amount: 200, due_date: '2024-03-10', is_active: true, created_at: '2024-02-01', updated_at: '2024-02-01' },
  { id: 3, name: 'Carlos Oliveira', email: 'carlos@email.com', phone: '11999990003', document: '456.789.123-00', amount: 180, due_date: '2024-03-25', is_active: true, created_at: '2024-02-10', updated_at: '2024-02-10' },
  { id: 4, name: 'Ana Costa', email: 'ana@email.com', phone: '11999990004', document: '321.654.987-00', amount: 150, due_date: '2024-02-15', is_active: false, created_at: '2024-03-01', updated_at: '2024-03-01' },
  { id: 5, name: 'Pedro Lima', email: 'pedro@email.com', phone: '11999990005', document: '789.123.456-00', amount: 250, due_date: '2024-04-10', is_active: true, created_at: '2024-03-15', updated_at: '2024-03-15' },
];

export const mockQueue: BillingQueue[] = [
  { id: 1, client_id: 1, client_name: 'João Silva', client_phone: '11999990001', message_type: 'reminder', status: 'pending', days_overdue: 0, amount: 150, due_date: '2024-03-20', created_at: '2024-03-18' },
  { id: 2, client_id: 2, client_name: 'Maria Santos', client_phone: '11999990002', message_type: 'overdue', status: 'sent', days_overdue: 5, amount: 200, due_date: '2024-03-10', sent_at: '2024-03-15', created_at: '2024-03-15' },
  { id: 3, client_id: 3, client_name: 'Carlos Oliveira', client_phone: '11999990003', message_type: 'due', status: 'pending', days_overdue: 0, amount: 180, due_date: '2024-03-20', created_at: '2024-03-20' },
  { id: 4, client_id: 4, client_name: 'Ana Costa', client_phone: '11999990004', message_type: 'blocked', status: 'failed', days_overdue: 30, amount: 150, due_date: '2024-02-15', error_message: 'Número inválido', created_at: '2024-03-17' },
];

export const mockTemplates: MessageTemplate[] = [
  { id: 1, name: 'Lembrete', type: 'reminder', content: '🚨 Olá {nome}, tudo bem?\nBom dia, aqui é um lembrete que sua fatura já está disponível.\n\n🗓 Vencimento: {data_vencimento}\n💰 Valor: R$ {valor}\n\nUtilize o link abaixo para efetuar o pagamento:\n{link_pagamento}\n\nApós vencimento será cobrado juros pela operadora.\n\nO pagamento é confirmado automaticamente. Você receberá o recibo em seguida, sem precisar enviar comprovante.', is_active: true, created_at: '2024-01-01' },
  { id: 2, name: 'Vencimento', type: 'due', content: 'Olá {nome}, seu boleto de R$ {valor} vence hoje ({data_vencimento}). Pague pelo link: {link_pagamento}', is_active: true, created_at: '2024-01-01' },
  { id: 3, name: 'Atraso', type: 'overdue', content: 'Olá {nome}!\n\nIdentificamos que sua mensalidade está em atraso.\n\n📅 Vencimento original: {data_vencimento}\n💵 Valor mensal: R$ {valor}\n📊 Multa: {multa}\n📈 Juros: {juros}\n💰 *Total a pagar: {valor_atualizado}*\n\nRegularize agora pelo PIX:\n{link_pagamento}\n\nEvite o bloqueio dos serviços.', is_active: true, created_at: '2024-01-01' },
  { id: 4, name: 'Recibo', type: 'receipt', content: 'Olá {nome}, confirmamos o recebimento de R$ {valor}. Obrigado!', is_active: true, created_at: '2024-01-01' },
];

export const mockContractTemplates: ContractTemplate[] = [
  { id: 1, name: 'Contrato Padrão de Serviço', content: 'CONTRATO DE PRESTAÇÃO DE SERVIÇO\n\nPelo presente instrumento...', is_default: true, created_at: '2024-01-01' },
];

export const mockDashboardStats: DashboardStats = {
  total_clients: 5,
  active_clients: 4,
  total_revenue_month: 3250,
  total_pending: 1580,
  total_overdue: 350,
  overdue_count: 2,
  paid_count: 8,
  pending_count: 3,
  revenue_by_month: [
    { month: 'Jan', amount: 2800 },
    { month: 'Fev', amount: 3100 },
    { month: 'Mar', amount: 3250 },
    { month: 'Abr', amount: 0 },
  ],
  status_distribution: [
    { status: 'Pago', count: 8 },
    { status: 'Pendente', count: 3 },
    { status: 'Atrasado', count: 2 },
  ],
};
