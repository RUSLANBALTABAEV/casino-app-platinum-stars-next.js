#!/bin/bash

# ===== ПОЛНЫЙ СКРИПТ РАЗВЕРТЫВАНИЯ НА СЕРВЕР =====
# ⚠️ ВНИМАНИЕ: Этот файл содержит пароли в открытом виде!
# Используйте deploy-full.sh.safe вместо этого файла!
# 
# Этот файл оставлен только для обратной совместимости.
# Все пароли должны быть изменены немедленно!

set -e

# Проверка наличия переменных окружения (приоритет над хардкодом)
SERVER_IP="${DEPLOY_SERVER_IP:-188.120.231.71}"
SERVER_USER="${DEPLOY_SERVER_USER:-root}"
SERVER_PASS="${DEPLOY_SERVER_PASS:-eiOPh83nda!!dAAAsio}"
DOMAIN="${DEPLOY_DOMAIN:-${1:-astrogame-io.ru}}"

if [ -z "$DEPLOY_SERVER_PASS" ]; then
    echo "⚠️ ВНИМАНИЕ: Используется пароль из скрипта!"
    echo "⚠️ Рекомендуется использовать переменные окружения или deploy-full.sh.safe"
    echo ""
fi

echo "🚀 Начинаем полное развертывание проекта на сервер $SERVER_IP..."

# Функция для выполнения команд на сервере
ssh_cmd() {
    if [ -n "$DEPLOY_SSH_KEY" ]; then
        ssh -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=yes "$SERVER_USER@$SERVER_IP" "$@"
    else
        sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=yes "$SERVER_USER@$SERVER_IP" "$@"
    fi
}

# Функция для загрузки файлов на сервер
scp_cmd() {
    if [ -n "$DEPLOY_SSH_KEY" ]; then
        scp -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=yes "$@"
    else
        sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=yes "$@"
    fi
}

echo "📦 Шаг 1: Упаковка проекта..."
cd /Users/aleksandr/Desktop/PROJECTS/casino
tar --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='*.log' \
    --exclude='backups' --exclude='builds' --exclude='dist*' --exclude='GOTOVO' \
    --exclude='PRRAV' --exclude='SBORKA' --exclude='PRODUCTION' --exclude='TEMP_FIX' \
    -czf /tmp/casino-deploy.tar.gz .

echo "📤 Шаг 2: Загрузка проекта на сервер..."
scp_cmd /tmp/casino-deploy.tar.gz "$SERVER_USER@$SERVER_IP:/root/"

echo "🔧 Шаг 3: Установка зависимостей на сервере..."
ssh_cmd "bash -s" << 'DEPLOY_SCRIPT'
set -e

echo "📦 Обновление системы..."
apt update && apt upgrade -y

echo "📦 Установка Node.js 20..."
if ! command -v node &> /dev/null; then
    # Безопасная установка Node.js с проверкой
    NODE_SETUP_URL="https://deb.nodesource.com/setup_20.x"
    NODE_SETUP_FILE="/tmp/node-setup.sh"
    
    if command -v wget &> /dev/null; then
        wget -O "$NODE_SETUP_FILE" "$NODE_SETUP_URL"
    elif command -v curl &> /dev/null; then
        curl -fsSL -o "$NODE_SETUP_FILE" "$NODE_SETUP_URL"
    else
        echo "❌ Не найден wget или curl"
        exit 1
    fi
    
    if [ ! -s "$NODE_SETUP_FILE" ]; then
        echo "❌ Ошибка загрузки скрипта установки Node.js"
        exit 1
    fi
    
    bash "$NODE_SETUP_FILE"
    apt-get install -y nodejs
    rm -f "$NODE_SETUP_FILE"
fi

echo "📦 Установка PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt install -y postgresql postgresql-contrib
fi

echo "📦 Установка PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

echo "📦 Установка Python зависимости для бота..."
apt install -y python3 python3-pip python3-venv

echo "📦 Установка Nginx и Certbot..."
apt install -y nginx certbot python3-certbot-nginx

echo "📦 Установка fail2ban для защиты..."
apt install -y fail2ban ufw

echo "🗄️ Настройка PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Создание базы данных и пользователя
sudo -u postgres psql -c "DROP DATABASE IF EXISTS casino;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS casino;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER casino WITH ENCRYPTED PASSWORD 'casino';" 2>/dev/null || true
sudo -u postgres psql -c "ALTER USER casino CREATEDB;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE casino OWNER casino;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE casino TO casino;" 2>/dev/null || true

echo "✅ Зависимости установлены"
DEPLOY_SCRIPT

echo "📂 Шаг 4: Распаковка проекта на сервере..."
ssh_cmd "cd /root && rm -rf casino-app && mkdir -p casino-app && cd casino-app && tar -xzf ../casino-deploy.tar.gz && rm ../casino-deploy.tar.gz"

echo "⚙️ Шаг 5: Настройка переменных окружения..."
ssh_cmd "cat > /root/casino-app/.env << 'ENVEOF'
NODE_ENV=production

# PostgreSQL
DATABASE_URL=postgresql://casino:casino@127.0.0.1:5432/casino?schema=public
DATABASE_URL_UNPOOLED=postgresql://casino:casino@127.0.0.1:5432/casino?schema=public
SHADOW_DATABASE_URL=postgresql://casino:casino@127.0.0.1:5432/casino?schema=public

# URLs
TELEGRAM_MINI_APP_URL=https://$DOMAIN
NEXT_PUBLIC_MINI_APP_URL=https://$DOMAIN
NEXT_PUBLIC_API_BASE_URL=https://$DOMAIN/api

# Токен бота (используйте переменную окружения DEPLOY_BOT_TOKEN)
TELEGRAM_BOT_TOKEN=${DEPLOY_BOT_TOKEN:-}

# JWT секрет
JWT_SECRET=\$(openssl rand -hex 32)

# Админка
ADMIN_SECRET=\$(openssl rand -hex 16)
ENVEOF"

echo "🗄️ Шаг 6: Настройка базы данных..."
ssh_cmd "cd /root/casino-app && npm install && npx prisma generate"

echo "📦 Шаг 6.1: Загрузка дампа базы данных..."
scp_cmd casino_backup_from_server_20251216_174734.dump "$SERVER_USER@$SERVER_IP:/root/"

echo "🗄️ Шаг 6.2: Восстановление базы данных из дампа..."
ssh_cmd "bash -s" << 'DB_RESTORE'
set -e
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Остановка приложения если запущено
pm2 stop casino 2>/dev/null || true

# Очистка базы данных
sudo -u postgres psql -d casino -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO casino;" 2>/dev/null || true

# Восстановление из дампа
if [ -f /root/casino_backup_from_server_20251216_174734.dump ]; then
    echo "Восстанавливаю базу из дампа..."
    sudo -u postgres pg_restore -d casino /root/casino_backup_from_server_20251216_174734.dump 2>&1 | tail -20 || {
        echo "Попытка восстановления через psql..."
        sudo -u postgres psql casino < /root/casino_backup_from_server_20251216_174734.dump 2>&1 | tail -20 || true
    }
else
    echo "Дамп не найден, применяю миграции..."
    cd /root/casino-app
    npx prisma db push
    npx prisma db seed || true
fi
DB_RESTORE

echo "🔨 Шаг 7: Сборка приложения..."
ssh_cmd "cd /root/casino-app && npm run build"

echo "🌐 Шаг 8: Настройка Nginx..."
ssh_cmd "bash -c \"cat > /etc/nginx/sites-available/$DOMAIN << 'NGINXEOF'
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_cache_bypass \\\$http_upgrade;
    }
}
NGINXEOF\""

ssh_cmd "ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN"
ssh_cmd "rm -f /etc/nginx/sites-enabled/default"
ssh_cmd "nginx -t && systemctl reload nginx"

echo "🔒 Шаг 9: Получение SSL сертификата..."
ssh_cmd "certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect || echo 'SSL setup may require manual intervention'"

echo "🚀 Шаг 10: Запуск приложения через PM2..."
ssh_cmd "cd /root/casino-app && pm2 stop casino 2>/dev/null || true"
ssh_cmd "cd /root/casino-app && pm2 delete casino 2>/dev/null || true"
ssh_cmd "cd /root/casino-app && pm2 start npm --name 'casino' -- start"
ssh_cmd "pm2 save"
ssh_cmd "pm2 startup systemd -u root --hp /root | tail -1 | bash || true"

echo "🤖 Шаг 11: Настройка Telegram бота..."
ssh_cmd "cd /root/casino-app/ASTROBOT && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"

ssh_cmd "cat > /root/casino-app/ASTROBOT/.env << 'BOTENVEOF'
TELEGRAM_BOT_TOKEN=8527758215:AAFYfDxDanduFoLXgnGot_ZObxP6ga9hoFc
BACKEND_BASE_URL=https://$DOMAIN
TELEGRAM_MINI_APP_URL=https://$DOMAIN
SUPPORT_CHAT_URL=https://t.me/
SUPPORT_USERNAME=platinumstar_manager
ADMIN_USERNAME=platinis
RECEIPTS_CHANNEL_ID=3250676900
TOPUP_URL=
WITHDRAW_URL=
BOTENVEOF"

ssh_cmd "cd /root/casino-app/ASTROBOT && pm2 stop astrobot 2>/dev/null || true"
ssh_cmd "cd /root/casino-app/ASTROBOT && pm2 delete astrobot 2>/dev/null || true"
ssh_cmd "cd /root/casino-app/ASTROBOT && source venv/bin/activate && pm2 start python3 --name 'astrobot' -- bot.py"
ssh_cmd "pm2 save"

echo "🛡️ Шаг 12: Настройка защиты сервера..."
ssh_cmd "bash -s" << 'SECURITY_SCRIPT'
set -e

# Настройка UFW (firewall)
ufw --force enable || true
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force reload

# Настройка fail2ban
cat > /etc/fail2ban/jail.local << 'FAIL2BANEOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log
FAIL2BANEOF

systemctl restart fail2ban
systemctl enable fail2ban

# Проверка на майнеры
echo "🔍 Проверка на майнеры..."
ps aux | grep -E '(minerd|xmrig|cpuminer|ccminer|stratum|mining|monero|bitcoin)' | grep -v grep || echo "Майнеры не найдены"

# Проверка подозрительных процессов с высоким CPU
echo "🔍 Проверка процессов с высоким CPU..."
ps aux --sort=-%cpu | head -10

SECURITY_SCRIPT

echo "✅ Развертывание завершено!"
echo ""
echo "📋 Проверка статуса:"
ssh_cmd "pm2 status"
echo ""
echo "🌐 Проверка домена: https://$DOMAIN"
echo ""
echo "📝 Следующие шаги:"
echo "1. Настройте DNS записи для домена $DOMAIN на IP $SERVER_IP"
echo "2. Проверьте работу приложения: curl https://$DOMAIN/api/test"
echo "3. Настройте бота в @BotFather с Web App URL: https://$DOMAIN"
