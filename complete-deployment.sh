#!/bin/bash
# Скрипт для завершения развертывания на сервере
# ⚠️ ВНИМАНИЕ: Этот файл содержит пароли в открытом виде!
# Используйте переменные окружения!

set -e

SERVER_IP="${DEPLOY_SERVER_IP:-188.120.231.71}"
SERVER_USER="${DEPLOY_SERVER_USER:-root}"
SERVER_PASS="${DEPLOY_SERVER_PASS:-eiOPh83nda!!dAAAsio}"

if [ -z "$DEPLOY_SERVER_PASS" ]; then
    echo "⚠️ ВНИМАНИЕ: Используется пароль из скрипта!"
    echo "⚠️ Рекомендуется использовать переменные окружения"
    echo ""
fi

if [ -n "$DEPLOY_SSH_KEY" ]; then
    ssh -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=yes "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
else
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=yes "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
fi
set -e

cd /root/casino-app

echo "📦 Установка зависимостей npm..."
npm install

echo "🗄️ Настройка базы данных..."
npx prisma generate
npx prisma db push || true
npx prisma db seed || true

echo "🔨 Сборка приложения..."
npm run build

echo "✅ Сборка завершена"
ENDSSH

echo "🚀 Запуск приложения..."
if [ -n "$DEPLOY_SSH_KEY" ]; then
    ssh -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=yes "$SERVER_USER@$SERVER_IP" "cd /root/casino-app && pm2 stop casino 2>/dev/null || true && pm2 delete casino 2>/dev/null || true && pm2 start npm --name 'casino' -- start && pm2 save"
else
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=yes "$SERVER_USER@$SERVER_IP" "cd /root/casino-app && pm2 stop casino 2>/dev/null || true && pm2 delete casino 2>/dev/null || true && pm2 start npm --name 'casino' -- start && pm2 save"
fi

echo "🌐 Настройка Nginx..."
if [ -n "$DEPLOY_SSH_KEY" ]; then
    ssh -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=yes "$SERVER_USER@$SERVER_IP" << 'NGINXSETUP'
else
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=yes "$SERVER_USER@$SERVER_IP" << 'NGINXSETUP'
fi
cat > /etc/nginx/sites-available/casino << 'EOF'
server {
    listen 80;
    server_name 188.120.231.71;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/casino /etc/nginx/sites-enabled/casino
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
NGINXSETUP

echo "🤖 Настройка бота..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no root@$SERVER_IP << 'BOTSETUP'
cd /root/casino-app/ASTROBOT
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cat > .env << 'EOF'
TELEGRAM_BOT_TOKEN=${DEPLOY_BOT_TOKEN:-}
BACKEND_BASE_URL=http://188.120.231.71
TELEGRAM_MINI_APP_URL=http://188.120.231.71
SUPPORT_CHAT_URL=https://t.me/
SUPPORT_USERNAME=platinumstar_manager
ADMIN_USERNAME=platinis
RECEIPTS_CHANNEL_ID=3250676900
TOPUP_URL=
WITHDRAW_URL=
EOF

pm2 stop astrobot 2>/dev/null || true
pm2 delete astrobot 2>/dev/null || true
pm2 start 'venv/bin/python bot.py' --name 'astrobot' --interpreter python3
pm2 save
BOTSETUP

echo "🛡️ Настройка защиты..."
if [ -n "$DEPLOY_SSH_KEY" ]; then
    ssh -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=yes "$SERVER_USER@$SERVER_IP" << 'SECURITY'
else
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=yes "$SERVER_USER@$SERVER_IP" << 'SECURITY'
fi
# UFW
ufw --force enable || true
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force reload

# Fail2ban
apt install -y fail2ban
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log
EOF

systemctl restart fail2ban
systemctl enable fail2ban

# Проверка майнеров
echo "🔍 Проверка на майнеры..."
ps aux | grep -E '(minerd|xmrig|cpuminer|ccminer|stratum|mining|monero|bitcoin)' | grep -v grep || echo "Майнеры не найдены"
SECURITY

echo "✅ Развертывание завершено!"
echo "Проверка статуса:"
if [ -n "$DEPLOY_SSH_KEY" ]; then
    ssh -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=yes "$SERVER_USER@$SERVER_IP" "pm2 status"
else
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=yes "$SERVER_USER@$SERVER_IP" "pm2 status"
fi
