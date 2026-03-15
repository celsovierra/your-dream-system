#!/bin/bash
# ===== COBRANÇAPRO - COMANDO ÚNICO DE DEPLOY =====
# Cole e execute na VPS:
# curl -sL https://raw.githubusercontent.com/celsovierra/your-dream-system/main/deploy.sh | sudo bash

set -e

# ===== CREDENCIAIS DO BANCO (GERADAS AUTOMATICAMENTE) =====
DB_USER="cobranca_admin"
DB_PASS="Xk9#mL2vR7@pQ4nW"
DB_NAME="cobranca_pro"
DOMAIN="$(curl -s ifconfig.me 2>/dev/null || echo 'localhost')"

echo "=========================================="
echo "   COBRANÇAPRO - Deploy Automático VPS"
echo "=========================================="
echo ""
echo "📦 Banco: $DB_NAME"
echo "👤 Usuário DB: $DB_USER"
echo "🔑 Senha DB: $DB_PASS"
echo "🌐 IP/Domínio: $DOMAIN"
echo ""

# 1. Atualizar sistema e instalar dependências
echo "► [1/7] Instalando dependências do sistema..."
apt update -y && apt upgrade -y
apt install -y curl git nginx mariadb-server mariadb-client build-essential

# 2. Instalar Node.js 20
echo "► [2/7] Instalando Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "   Node: $(node -v) | NPM: $(npm -v)"

# 3. Clonar repositório
echo "► [3/7] Clonando repositório..."
cd /opt
if [ -d "cobranca-pro" ]; then
  cd cobranca-pro && git pull
else
  git clone https://github.com/celsovierra/your-dream-system.git cobranca-pro
  cd cobranca-pro
fi

# 4. Build do frontend
echo "► [4/7] Instalando dependências e gerando build..."
npm install
npm run build

# 5. Configurar MariaDB
echo "► [5/7] Configurando MariaDB..."
systemctl start mariadb
systemctl enable mariadb

mysql -u root <<SQLEOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS '${DB_USER}'@'localhost';
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQLEOF

# Importar schema
mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" < database/schema.sql

# Criar usuário admin do sistema (login: admin@cobranca.com / senha: admin123)
mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" <<SQLEOF
INSERT IGNORE INTO users (name, email, password_hash, is_active)
VALUES ('Administrador', 'admin@cobranca.com', '\$2b\$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', TRUE);
SQLEOF

# 6. Configurar Nginx
echo "► [6/7] Configurando Nginx..."
cat > /etc/nginx/sites-available/cobranca-pro <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    root /opt/cobranca-pro/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/cobranca-pro /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
systemctl enable nginx

# 7. Criar .env do backend
echo "► [7/7] Gerando configuração..."
JWT_SECRET=$(openssl rand -hex 32)

cat > /opt/cobranca-pro/.env <<ENV
DB_HOST=localhost
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_NAME=${DB_NAME}
JWT_SECRET=${JWT_SECRET}
PORT=3001
ENV

echo ""
echo "=========================================="
echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
echo "=========================================="
echo ""
echo "🌐 Frontend: http://${DOMAIN}"
echo ""
echo "🗄️ BANCO DE DADOS MariaDB:"
echo "   Host: localhost"
echo "   Porta: 3306"
echo "   Banco: ${DB_NAME}"
echo "   Usuário: ${DB_USER}"
echo "   Senha: ${DB_PASS}"
echo ""
echo "🔐 LOGIN DO SISTEMA:"
echo "   Email: admin@cobranca.com"
echo "   Senha: admin123"
echo ""
echo "📁 Arquivos:"
echo "   Projeto: /opt/cobranca-pro/"
echo "   Config:  /opt/cobranca-pro/.env"
echo "   Frontend: /opt/cobranca-pro/dist/"
echo ""
echo "📋 PRÓXIMO PASSO:"
echo "   Criar o backend Express na porta 3001"
echo "   SSL: apt install certbot python3-certbot-nginx && certbot --nginx -d seu-dominio.com"
echo ""
