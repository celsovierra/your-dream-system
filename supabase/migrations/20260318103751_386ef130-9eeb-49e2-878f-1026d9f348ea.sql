
-- Tabela de tenants (empresas/usuários SaaS)
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  api_url text,
  admin_email text,
  admin_password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access tenants" ON tenants FOR ALL TO public USING (true) WITH CHECK (true);

-- Configuração Google Drive
CREATE TABLE IF NOT EXISTS google_drive_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text,
  client_secret text,
  refresh_token text,
  folder_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE google_drive_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access google_drive_config" ON google_drive_config FOR ALL TO public USING (true) WITH CHECK (true);

-- Configuração WhatsApp por tenant
CREATE TABLE IF NOT EXISTS tenant_whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  api_url text,
  api_key text,
  instance_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tenant_whatsapp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access tenant_whatsapp_config" ON tenant_whatsapp_config FOR ALL TO public USING (true) WITH CHECK (true);

-- Configuração de cobrança por cliente/tenant
CREATE TABLE IF NOT EXISTS client_billing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id integer NOT NULL,
  user_name text,
  user_phone text,
  due_day integer NOT NULL DEFAULT 10,
  amount numeric NOT NULL DEFAULT 50,
  billing_cycle text NOT NULL DEFAULT 'mensal',
  auto_charge boolean NOT NULL DEFAULT true,
  cobrar boolean NOT NULL DEFAULT true,
  desconto numeric NOT NULL DEFAULT 0,
  next_due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
ALTER TABLE client_billing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access client_billing_config" ON client_billing_config FOR ALL TO public USING (true) WITH CHECK (true);

-- Modelos de contrato
CREATE TABLE IF NOT EXISTS contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  content text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access contract_templates" ON contract_templates FOR ALL TO public USING (true) WITH CHECK (true);

-- Convites / Contratos assinados
CREATE TABLE IF NOT EXISTS contract_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id uuid REFERENCES contract_templates(id),
  token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  client_name text,
  client_user_id integer,
  client_data jsonb DEFAULT '{}'::jsonb,
  signed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  google_drive_file_id text,
  google_drive_file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE contract_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access contract_invites" ON contract_invites FOR ALL TO public USING (true) WITH CHECK (true);
