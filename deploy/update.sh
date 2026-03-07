#!/bin/bash
# Quick redeploy after pushing changes to GitHub
# Run as: ssh root@YOUR_VPS_IP 'bash -s' < deploy/update.sh

set -e
echo "🔄 Updating TrajectData Dashboard..."

cd /home/tdapp/app
su - tdapp -c "cd /home/tdapp/app && git pull origin main"
su - tdapp -c "cd /home/tdapp/app && npm install"
su - tdapp -c "cd /home/tdapp/app && npm run build"

systemctl restart td-backend
echo "✅ Updated and restarted!"
