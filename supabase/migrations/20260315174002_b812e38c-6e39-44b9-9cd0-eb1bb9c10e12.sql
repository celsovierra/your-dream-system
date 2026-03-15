
-- Tabela de clientes (espelho do MariaDB)
CREATE TABLE public.clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  phone2 TEXT,
  document TEXT,
  amount DECIMAL(10,2),
  due_date DATE,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de templates de mensagem
CREATE TABLE public.message_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('reminder','due','overdue','receipt','blocked')),
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Dados iniciais dos templates
INSERT INTO public.message_templates (name, type, content) VALUES
('Lembrete', 'reminder', 'Olá {nome}, lembramos que seu boleto de R$ {valor} vence em {data_vencimento}.'),
('Vencimento', 'due', 'Olá {nome}, seu boleto de R$ {valor} vence hoje ({data_vencimento}). Pague pelo link: {link_pagamento}'),
('Atraso', 'overdue', 'Olá {nome}, seu boleto de R$ {valor} está em atraso há {dias_atraso} dias. Regularize: {link_pagamento}'),
('Recibo', 'receipt', 'Olá {nome}, confirmamos o recebimento de R$ {valor}. Obrigado!');

-- RLS desabilitado pois é sistema interno single-tenant
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Políticas públicas (sistema interno, acesso total)
CREATE POLICY "Allow all on clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on message_templates" ON public.message_templates FOR ALL USING (true) WITH CHECK (true);
