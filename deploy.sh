#!/bin/bash
# ===== DEPLOY COBRANÇAPRO NA VPS =====
# Execute: chmod +x deploy.sh && sudo ./deploy.sh

set -e

echo "=========================================="
echo "   COBRANÇAPRO - Deploy na VPS"
echo "=========================================="

# Solicitar credenciais do banco
read -p "Digite o usuário do MariaDB [cobranca]: " DB_USER
DB_USER=${DB_USER:-cobranca}

read -sp "Digite a senha do MariaDB: " DB_PASS
echo ""

read -p "Digite o nome do banco [cobranca_pro]: " DB_NAME
DB_NAME=${DB_NAME:-cobranca_pro}

read -p "Digite seu domínio ou IP [localhost]: " DOMAIN
DOMAIN=${DOMAIN:-localhost}

echo ""
echo "► Configuração:"
echo "  Usuário DB: $DB_USER"
echo "  Banco: $DB_NAME"
echo "  Domínio: $DOMAIN"
echo ""
read -p "Confirma? (s/n): " CONFIRM
if [ "$CONFIRM" != "s" ]; then echo "Cancelado."; exit 1; fi

# 1. Instalar dependências do sistema
echo "► Instalando dependências..."
apt update && apt upgrade -y
apt install -y curl git nginx mariadb-server mariadb-client

# Instalar Node.js 20
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

# 2. Clonar repositório
echo "► Clonando repositório..."
cd /opt
if [ -d "cobranca-pro" ]; then
  cd cobranca-pro && git pull
else
  git clone https://github.com/celsovierra/your-dream-system.git cobranca-pro
  cd cobranca-pro
fi

# 3. Build do frontend
echo "► Instalando dependências e buildando..."
npm install
npm run build

# 4. Configurar MariaDB
echo "► Configurando MariaDB..."
systemctl start mariadb
systemctl enable mariadb

mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

# 5. Importar schema
echo "► Importando schema do banco..."
mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" < database/schema.sql

# 6. Inserir usuário admin padrão (senha: admin123 com hash bcrypt)
mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" <<EOF
INSERT IGNORE INTO users (name, email, password_hash, is_active)
VALUES ('Administrador', 'admin@cobranca.com', '\$2b\$10\$YourHashHere', TRUE);
EOF

# 7. Configurar Nginx
echo "► Configurando Nginx..."
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

# 8. Criar arquivo .env para o backend
cat > /opt/cobranca-pro/.env <<ENV
DB_HOST=localhost
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_NAME=${DB_NAME}
JWT_SECRET=$(openssl rand -hex 32)
PORT=3001
ENV

echo ""
echo "=========================================="
echo "✅ DEPLOY CONCLUÍDO!"
echo "=========================================="
echo ""
echo "Frontend: http://${DOMAIN}"
echo "Banco: ${DB_NAME} (usuário: ${DB_USER})"
echo "Config: /opt/cobranca-pro/.env"
echo ""
echo "⚠️  Próximos passos:"
echo "1. Criar o backend Express (porta 3001)"
echo "2. Instalar PM2: npm install -g pm2"
echo "3. SSL: apt install certbot python3-certbot-nginx && certbot --nginx -d ${DOMAIN}"
echo ""
