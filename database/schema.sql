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
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_document (document)
);

-- Adicionar colunas novas caso a tabela já exista (idempotente)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone2 VARCHAR(20) AFTER phone;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2) AFTER document;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS due_date DATE AFTER amount;

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
  message_type ENUM('reminder','due','overdue','receipt','blocked') NOT NULL,
  status ENUM('pending','sent','failed','cancelled') DEFAULT 'pending',
  days_overdue INT DEFAULT 0,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  message_content TEXT,
  sent_at TIMESTAMP NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_due_date (due_date)
);

-- Templates de mensagem
CREATE TABLE IF NOT EXISTS message_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type ENUM('reminder','due','overdue','receipt','blocked') NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Dados iniciais
INSERT INTO message_templates (name, type, content) VALUES
('Lembrete', 'reminder', 'Olá {nome}, lembramos que seu boleto de R$ {valor} vence em {data_vencimento}.'),
('Vencimento', 'due', 'Olá {nome}, seu boleto de R$ {valor} vence hoje. Pague pelo link: {link_pagamento}'),
('Atraso', 'overdue', 'Olá {nome}, seu boleto de R$ {valor} está em atraso há {dias_atraso} dias. Regularize: {link_pagamento}'),
('Recibo', 'receipt', 'Olá {nome}, confirmamos o recebimento de R$ {valor}. Obrigado!');
