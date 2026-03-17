-- ===== SCHEMA MARIADB PARA VPS =====
-- Execute este script no MariaDB da sua VPS para criar as tabelas

SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS cobranca_pro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cobranca_pro;

-- Usuários do sistema (SaaS)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role ENUM('admin','user') DEFAULT 'user',
  client_limit INT DEFAULT 0,
  expires_at DATE NULL,
  permissions JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Clientes
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  phone2 VARCHAR(20),
  document VARCHAR(20),
  amount DECIMAL(10,2),
  due_date DATE,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  traccar_email VARCHAR(255),
  notes TEXT,
  owner_id VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_document (document),
  INDEX idx_owner (owner_id)
);

-- Contas a pagar (Financeiro)
CREATE TABLE IF NOT EXISTS bills_payable (
  id INT AUTO_INCREMENT PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  supplier VARCHAR(255),
  category VARCHAR(100),
  payment_type ENUM('single','installment') NOT NULL DEFAULT 'single',
  total_amount DECIMAL(10,2) NOT NULL,
  installments_count INT DEFAULT 1,
  current_installment INT DEFAULT 1,
  parent_bill_id INT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE NULL,
  status ENUM('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
  notes TEXT,
  owner_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bills_due_date (due_date),
  INDEX idx_bills_status (status),
  INDEX idx_bills_parent (parent_bill_id),
  INDEX idx_bills_owner (owner_id),
  CONSTRAINT fk_bills_parent FOREIGN KEY (parent_bill_id) REFERENCES bills_payable(id) ON DELETE CASCADE
);

-- Configuração de cobrança por cliente
CREATE TABLE IF NOT EXISTS client_billing_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  due_day INT NOT NULL DEFAULT 10,
  amount DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  description VARCHAR(255) DEFAULT 'Mensalidade',
  is_active BOOLEAN DEFAULT TRUE,
  next_due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  INDEX idx_next_due (next_due_date)
);

-- Fila de mensagens de cobrança
CREATE TABLE IF NOT EXISTS billing_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  client_name VARCHAR(255) NOT NULL DEFAULT '',
  client_phone VARCHAR(20) NOT NULL DEFAULT '',
  type VARCHAR(50) NOT NULL DEFAULT 'reminder',
  status VARCHAR(20) DEFAULT 'pending',
  days_overdue INT DEFAULT 0,
  amount DECIMAL(10,2),
  due_date DATE,
  message TEXT,
  owner_id VARCHAR(100),
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_due_date (due_date),
  INDEX idx_queue_owner (owner_id)
);

-- Templates de mensagem
CREATE TABLE IF NOT EXISTS message_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  owner_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_templates_owner (owner_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Garantir utf8mb4 em instalações existentes (necessário para emojis)
ALTER TABLE message_templates CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Configurações de cobrança (key-value)
CREATE TABLE IF NOT EXISTS billing_settings (
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT NOT NULL,
  owner_id VARCHAR(100) NOT NULL DEFAULT '__global__',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`, owner_id)
);

-- Links de pagamento
CREATE TABLE IF NOT EXISTS payment_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description VARCHAR(255),
  payment_url TEXT,
  qr_code TEXT,
  status ENUM('pending','paid','expired','cancelled') DEFAULT 'pending',
  gateway_data JSON,
  paid_at TIMESTAMP NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  INDEX idx_status (status)
);

-- Dedup de pagamentos processados
CREATE TABLE IF NOT EXISTS processed_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  external_payment_id VARCHAR(255) NOT NULL UNIQUE,
  payment_link_id INT,
  amount DECIMAL(10,2),
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_link_id) REFERENCES payment_links(id)
);

-- Estado de bloqueio
CREATE TABLE IF NOT EXISTS user_blocked_states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL UNIQUE,
  is_blocked BOOLEAN DEFAULT FALSE,
  blocked_at TIMESTAMP NULL,
  unblocked_at TIMESTAMP NULL,
  reason VARCHAR(255),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Modelos de contrato
CREATE TABLE IF NOT EXISTS contract_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contratos
CREATE TABLE IF NOT EXISTS contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  template_id INT NOT NULL,
  status ENUM('draft','sent','signed','cancelled') DEFAULT 'draft',
  invite_token VARCHAR(255) UNIQUE,
  signature_data LONGTEXT,
  signed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES contract_templates(id),
  INDEX idx_token (invite_token)
);

-- Configuração WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  api_url VARCHAR(255),
  api_key VARCHAR(255),
  instance_name VARCHAR(100),
  status ENUM('connected','disconnected','connecting') DEFAULT 'disconnected',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Configuração Gateway de Pagamento
CREATE TABLE IF NOT EXISTS payment_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  gateway ENUM('mercadopago','pix_manual') DEFAULT 'mercadopago',
  access_token VARCHAR(255),
  webhook_secret VARCHAR(255),
  webhook_url VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ===== MIGRAÇÕES IDEMPOTENTES (para instalações existentes) =====
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone2 VARCHAR(20) AFTER phone;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2) AFTER document;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS due_date DATE AFTER amount;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS traccar_email VARCHAR(255) AFTER notes;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_id VARCHAR(100) AFTER traccar_email;

ALTER TABLE bills_payable ADD COLUMN IF NOT EXISTS supplier VARCHAR(255) AFTER description;
ALTER TABLE bills_payable ADD COLUMN IF NOT EXISTS category VARCHAR(100) AFTER supplier;
ALTER TABLE bills_payable ADD COLUMN IF NOT EXISTS owner_id VARCHAR(100) AFTER notes;

ALTER TABLE billing_queue ADD COLUMN IF NOT EXISTS client_name VARCHAR(255) NOT NULL DEFAULT '' AFTER client_id;
ALTER TABLE billing_queue ADD COLUMN IF NOT EXISTS client_phone VARCHAR(20) NOT NULL DEFAULT '' AFTER client_name;
ALTER TABLE billing_queue ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'reminder' AFTER client_phone;
ALTER TABLE billing_queue ADD COLUMN IF NOT EXISTS message TEXT AFTER due_date;
ALTER TABLE billing_queue ADD COLUMN IF NOT EXISTS owner_id VARCHAR(100) AFTER message;

ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS owner_id VARCHAR(100) AFTER is_active;

-- Migração: billing_settings — corrigir owner_id NULL para '__global__'
UPDATE billing_settings SET owner_id = '__global__' WHERE owner_id IS NULL;
-- Se a tabela já existia com owner_id nullable, corrige para NOT NULL DEFAULT '__global__'
ALTER TABLE billing_settings MODIFY COLUMN owner_id VARCHAR(100) NOT NULL DEFAULT '__global__';

-- Migrações SaaS: campos extras na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) AFTER password_hash;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role ENUM('admin','user') DEFAULT 'user' AFTER phone;
ALTER TABLE users ADD COLUMN IF NOT EXISTS client_limit INT DEFAULT 0 AFTER role;
ALTER TABLE users ADD COLUMN IF NOT EXISTS expires_at DATE NULL AFTER client_limit;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSON AFTER expires_at;

-- Slug para URL personalizada (ex: /gpswill)
ALTER TABLE users ADD COLUMN IF NOT EXISTS slug VARCHAR(100) AFTER permissions;
ALTER TABLE users ADD COLUMN IF NOT EXISTS layout_company_name VARCHAR(255) AFTER slug;
ALTER TABLE users ADD COLUMN IF NOT EXISTS layout_logo LONGTEXT AFTER layout_company_name;
ALTER TABLE users ADD COLUMN IF NOT EXISTS layout_primary_color VARCHAR(10) AFTER layout_logo;

-- Definir primeiro usuário como admin
UPDATE users SET role = 'admin' WHERE id = (SELECT min_id FROM (SELECT MIN(id) AS min_id FROM users) AS t);

-- Dados iniciais - admin padrão (senha: admin123 -> SHA256)
INSERT IGNORE INTO users (name, email, password_hash, role) VALUES
('Administrador', 'admin@cobranca.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin');

-- ===== LIMPAR TEMPLATES DUPLICADOS (manter apenas 1 por tipo onde owner_id IS NULL) =====
DELETE t1 FROM message_templates t1
INNER JOIN message_templates t2
WHERE t1.type = t2.type
  AND t1.owner_id IS NULL AND t2.owner_id IS NULL
  AND t1.id > t2.id;

-- ===== TEMPLATES PADRÃO: INSERT OU UPDATE (garante conteúdo correto em toda atualização) =====
INSERT INTO message_templates (id, name, type, content, is_active) VALUES
(1, 'Lembrete', 'reminder', '🚨 Olá *{nome}*, tudo bem?\nBom dia, aqui é um lembrete que sua fatura já está disponível.\n\n🗓 *Vencimento:* {vencimento}\n💰 *Valor:* R$ {valor}\n💸 *Desconto:* {desconto}\n\nPIX Copia e Cola:\n{pix_copia_cola}\n\nApós vencimento será cobrado juros pela operadora.\n\n_O pagamento é confirmado automaticamente. Você receberá o recibo em seguida, sem precisar enviar comprovante._', 1),
(2, 'Vencimento', 'due', 'Olá *{nome}*!\n\nSua mensalidade está disponível para pagamento.\n\n📅 *Vencimento:* {vencimento}\n💰 *Valor:* R$ {valor}\n💸 *Desconto:* {desconto}\n\nPague agora pelo PIX:\n{pix_copia_cola}\n\n_Após o pagamento, você receberá seu recibo automaticamente._', 1),
(3, 'Atraso', 'overdue', 'Olá *{nome}*!\n\nIdentificamos que sua mensalidade está em atraso.\n\n📅 *Vencimento original:* {vencimento}\n💵 *Valor mensal:* R$ {valor}\n📊 *Multa:* {multa}\n📈 *Juros:* {juros}\n💰 *Total a pagar: {valor_atualizado}*\n\nRegularize agora pelo PIX:\n{pix_copia_cola}\n\n_Evite o bloqueio dos serviços._', 1),
(4, 'Recibo', 'receipt', '✅ *Pagamento Confirmado!* ✅\n\n```RECIBO DE PAGAMENTO\n=======================\nCliente : {nome}\nServiço : Rastreamento\nPeríodo : {vencimento}\nValor   : R$ {valor}\nMulta   : {multa}\nJuros   : {juros}\nDesconto: {desconto}\n\nValor Total : {valor_atualizado}\n=======================\nPago em : {data_hoje}\nStatus  : ✅PAGO✅\nPróx Venc: {prox_vencimento}\n=======================```', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  content = VALUES(content),
  is_active = VALUES(is_active);
