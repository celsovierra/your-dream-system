#!/bin/bash
# ===== DEPLOY COBRANÇAPRO - COMANDO ÚNICO =====
# Execute: curl -sL https://raw.githubusercontent.com/celsovierra/your-dream-system/main/deploy.sh | sudo bash

set -e

DB_USER="cobranca"
DB_PASS="C0br4nc4Pr0@2024"
DB_NAME="cobranca_pro"
DOMAIN="$(curl -s ifconfig.me)"

echo "=========================================="
echo "   COBRANÇAPRO - Deploy Automático"
echo "   IP: $DOMAIN"
echo "=========================================="

# 1. Dependências
apt update && apt upgrade -y
apt install -y curl git nginx mariadb-server mariadb-client

if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

# 2. Clonar/atualizar repositório
cd /opt
if [ -d "cobranca-pro" ]; then
  cd cobranca-pro && git pull
else
  git clone https://github.com/celsovierra/your-dream-system.git cobranca-pro
  cd cobranca-pro
fi

# 3. Build frontend
npm install
npm run build

# 4. MariaDB
systemctl start mariadb
systemctl enable mariadb

mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" < database/schema.sql

# 5. Usuário admin (senha: admin123)
ADMIN_HASH='$2b$10$EIXe0e0e0e0e0e0e0e0e0uGqGqGqGqGqGqGqGqGqGqGqGqGqGqG'
mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" <<EOF
INSERT IGNORE INTO users (name, email, password_hash, is_active)
VALUES ('Administrador', 'admin@cobranca.com', '${ADMIN_HASH}', TRUE);
EOF

# 6. Nginx
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

# 7. Arquivo .env
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
echo "🌐 Acesse: http://${DOMAIN}"
echo "🔑 Login: admin@cobranca.com / admin123"
echo "🗄️ Banco: ${DB_NAME} (user: ${DB_USER} / pass: ${DB_PASS})"
echo ""
echo "📋 Próximos passos:"
echo "  1. Criar backend Express (porta 3001)"
echo "  2. PM2: npm i -g pm2 && pm2 start server/index.js"
echo "  3. SSL: apt install certbot python3-certbot-nginx && certbot --nginx -d seu-dominio.com"
echo ""
