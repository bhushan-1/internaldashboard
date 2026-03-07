#!/bin/bash
# ============================================
# TrajectData Internal Dashboard - VPS Setup
# Run as root on a fresh Ubuntu 24.04 VPS
# ============================================

set -e
echo "🚀 Setting up TrajectData Internal Dashboard..."

# ── 1. System updates ──
echo "📦 Updating system..."
apt update && apt upgrade -y

# ── 2. Install Node.js 22 ──
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git nginx certbot python3-certbot-nginx ufw

# ── 3. Create app user ──
echo "👤 Creating app user..."
useradd -m -s /bin/bash tdapp || true

# ── 4. Clone the project ──
echo "📥 Cloning project..."
su - tdapp -c "git clone https://github.com/bhushan-1/internaldashboard.git /home/tdapp/app"
su - tdapp -c "cd /home/tdapp/app && npm install"
su - tdapp -c "cd /home/tdapp/app/server && npm install"

# ── 5. Build frontend ──
echo "🔨 Building frontend..."
su - tdapp -c "cd /home/tdapp/app && npm run build"

# ── 6. Create systemd service for backend ──
echo "⚙️ Creating systemd service..."
cat > /etc/systemd/system/td-backend.service << 'EOF'
[Unit]
Description=TrajectData Backend
After=network.target

[Service]
Type=simple
User=tdapp
WorkingDirectory=/home/tdapp/app
ExecStart=/usr/bin/node server/index.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable td-backend
systemctl start td-backend
echo "✅ Backend service started"

# ── 7. Configure Nginx ──
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/trajectdata << 'NGINX'
server {
    listen 80;
    server_name _;

    # Frontend - serve built files
    root /home/tdapp/app/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/trajectdata /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
echo "✅ Nginx configured"

# ── 8. Firewall ──
echo "🔒 Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "✅ Firewall enabled (SSH + HTTP/HTTPS only)"

# ── 9. Summary ──
IP=$(curl -s ifconfig.me)
echo ""
echo "============================================"
echo "✅ SETUP COMPLETE!"
echo "============================================"
echo ""
echo "  Dashboard:  http://$IP"
echo "  Login:      admin@trajectdata.com / Admin@123"
echo ""
echo "  Backend:    systemctl status td-backend"
echo "  Logs:       journalctl -u td-backend -f"
echo "  Restart:    systemctl restart td-backend"
echo ""
echo "  NEXT STEPS:"
echo "  1. Point your domain (e.g. dash.trajectdata.com) to $IP"
echo "  2. Run: certbot --nginx -d dash.trajectdata.com"
echo "     This adds free HTTPS automatically"
echo "  3. Change the default admin password!"
echo ""
echo "============================================"
