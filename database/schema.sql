-- ===== SCHEMA MARIADB PARA VPS =====
-- Execute este script no MariaDB da sua VPS para criar as tabelas

CREATE DATABASE IF NOT EXISTS cobranca_pro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cobranca_pro;

-- Usuários do sistema (admin)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
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
);

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

-- Dados iniciais - admin padrão (senha: admin123 -> SHA256)
INSERT IGNORE INTO users (name, email, password_hash) VALUES
('Administrador', 'admin@cobranca.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9');

-- Dados iniciais de templates (ignora se já existirem)
INSERT IGNORE INTO message_templates (id, name, type, content) VALUES
(1, 'Lembrete', 'reminder', '🚨 Olá {nome}, tudo bem?\nBom dia, aqui é um lembrete que sua fatura já está disponível.\n\n🗓 Vencimento: {data_vencimento}\n💰 Valor: R$ {valor}\n\nUtilize o link abaixo para efetuar o pagamento:\n{link_pagamento}\n\nApós vencimento será cobrado juros pela operadora.\n\nO pagamento é confirmado automaticamente. Você receberá o recibo em seguida, sem precisar enviar comprovante.'),
(2, 'Vencimento', 'due', 'Olá {nome}, seu boleto de R$ {valor} vence hoje. Pague pelo link: {link_pagamento}'),
(3, 'Atraso', 'overdue', 'Olá {nome}, seu boleto de R$ {valor} está em atraso há {dias_atraso} dias. Regularize: {link_pagamento}'),
(4, 'Recibo', 'receipt', 'Olá {nome}, confirmamos o recebimento de R$ {valor}. Obrigado!');
