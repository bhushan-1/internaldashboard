# VPS Deployment Guide

## Requirements
- Ubuntu 22.04+ VPS (DigitalOcean, Hetzner, AWS EC2, etc.)
- Minimum: 1 vCPU, 1GB RAM, 20GB disk
- Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)

## Quick Deploy (one command)

SSH into your VPS and run:

```bash
git clone https://github.com/bhushan-1/internaldashboard.git /opt/internaldashboard
cd /opt/internaldashboard
bash deploy/setup.sh your-domain.com
```

Replace `your-domain.com` with your domain or leave blank to use the server IP.

## What the script does

1. Installs nginx, Node.js 22, PM2
2. Clones the repo to `/opt/internaldashboard`
3. Installs dependencies and builds the frontend
4. Configures nginx (reverse proxy: `/api/*` → Express, everything else → Vite build)
5. Starts the API server via PM2 (auto-restarts on crash, starts on boot)

## After deployment

**Login:** `http://your-domain.com`
- Default: `admin@trajectdata.com` / `Admin@123`
- Change this immediately in Admin Settings

**Enable HTTPS:**
```bash
sudo certbot --nginx -d your-domain.com
```

## Updating

After pushing changes to GitHub:
```bash
bash /opt/internaldashboard/deploy/update.sh
```

## Architecture on VPS

```
Client → nginx (:80/:443)
            ├── /api/*  → Express server (:3001) → MongoDB Atlas
            └── /*      → Static files (dist/)
```

## Useful commands

```bash
pm2 logs td-api        # View API logs
pm2 restart td-api     # Restart API
pm2 status             # Check process status
sudo nginx -t          # Test nginx config
sudo systemctl reload nginx
```

## MongoDB connection

The API connects to MongoDB Atlas using the connection string in `server/index.cjs`.
For production MongoDB with SSH tunnel, use `server/production.cjs` on port 3002.
