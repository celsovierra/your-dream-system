-- Tabela de fila de cobrança automatizada (MariaDB)
CREATE TABLE IF NOT EXISTS billing_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL COMMENT 'reminder, due, overdue',
  amount DECIMAL(10,2),
  due_date DATE,
  days_overdue INT DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending, sent, failed',
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela de configurações
CREATE TABLE IF NOT EXISTS billing_settings (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` VARCHAR(500) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Valores padrão
INSERT IGNORE INTO billing_settings (`key`, `value`) VALUES
  ('reminder_days', '3'),
  ('send_time_reminder', '08:00'),
  ('send_time_due', '08:00'),
  ('send_time_overdue', '09:00'),
  ('overdue_frequency', '3');
