#!/bin/bash
# Quick update — run after pushing changes to GitHub
# Usage: bash deploy/update.sh

set -e
APP_DIR="/opt/internaldashboard"

cd "$APP_DIR"
echo "Pulling latest..."
git pull origin main

echo "Installing dependencies..."
npm ci
cd server && npm ci && cd ..

echo "Building frontend..."
npm run build

echo "Restarting API..."
pm2 restart td-api

echo "Done! Dashboard updated."
