#!/bin/bash
# TrajectData Internal Dashboard — VPS Deploy Script
# Run this on your VPS after initial setup
# Usage: bash deploy/setup.sh

set -e

APP_DIR="/opt/internaldashboard"
REPO="https://github.com/bhushan-1/internaldashboard.git"
DOMAIN="${1:-$(hostname -I | awk '{print $1}')}"

echo "=== TrajectData Dashboard — VPS Setup ==="
echo "Domain/IP: $DOMAIN"
echo ""

# 1. System packages
echo "[1/7] Installing system packages..."
sudo apt update -y
sudo apt install -y nginx certbot python3-certbot-nginx curl git

# 2. Node.js (via nvm)
echo "[2/7] Installing Node.js..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm use 22
fi
echo "Node: $(node -v)"

# 3. PM2
echo "[3/7] Installing PM2..."
npm install -g pm2

# 4. Clone / pull repo
echo "[4/7] Setting up app..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git pull origin main
else
  sudo git clone "$REPO" "$APP_DIR"
  sudo chown -R $USER:$USER "$APP_DIR"
  cd "$APP_DIR"
fi

# 5. Install deps & build
echo "[5/7] Installing dependencies & building..."
npm ci
cd server && npm ci && cd ..
mkdir -p logs
npm run build

# 6. Nginx config
echo "[6/7] Configuring nginx..."
sudo cp deploy/nginx.conf /etc/nginx/sites-available/td-dashboard
sudo sed -i "s/YOUR_DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/td-dashboard
sudo ln -sf /etc/nginx/sites-available/td-dashboard /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 7. Start API with PM2
echo "[7/7] Starting API server..."
pm2 delete td-api 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "Dashboard: http://$DOMAIN"
echo "API:       http://$DOMAIN/api/health"
echo ""
echo "Default login: admin@trajectdata.com / Admin@123"
echo ""
echo "Next steps:"
echo "  1. Update the admin password after first login"
echo "  2. For HTTPS, run: sudo certbot --nginx -d $DOMAIN"
echo "     Then uncomment the HTTPS block in /etc/nginx/sites-available/td-dashboard"
echo "  3. To update later: cd $APP_DIR && git pull && npm ci && npm run build && pm2 restart td-api"
echo ""
echo "PM2 commands:"
echo "  pm2 logs td-api    — view logs"
echo "  pm2 restart td-api — restart API"
echo "  pm2 status         — check status"
