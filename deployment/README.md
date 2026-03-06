# BotDash VPS Deployment Guide

This guide provides step-by-step instructions for deploying BotDash on a VPS .

## Table of Contents

- [Prerequisites](#prerequisites)
- [Server Setup](#server-setup)
- [Database Setup](#database-setup)
- [Application Deployment](#application-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Migration](#database-migration)
- [Process Management with PM2](#process-management-with-pm2)
- [Nginx Configuration](#nginx-configuration)
- [SSL Certificate Setup](#ssl-certificate-setup)
- [Firewall Configuration](#firewall-configuration)
- [Docker Alternative](#docker-alternative)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- VPS with Ubuntu 20.04+ (Hostinger, DigitalOcean, etc.)
- Domain name pointed to your VPS IP address
- SSH access to your VPS
- Basic knowledge of Linux commands

## Server Setup

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Install PostgreSQL

```bash
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 4. Install Nginx

```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5. Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 6. Install Git

```bash
sudo apt install git -y
```

## Database Setup

### 1. Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# Inside PostgreSQL console
CREATE DATABASE botdash;
CREATE USER botdash_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE botdash TO botdash_user;
ALTER USER botdash_user CREATEDB;
\q
```

### 2. Test Database Connection

```bash
psql -h localhost -U botdash_user -d botdash -c "SELECT version();"
```

## Application Deployment

### 1. Clone Repository

```bash
# Create application directory
sudo mkdir -p /var/www
cd /var/www

# Clone your repository
sudo git clone https://github.com/your-username/BotDash.git botdash
cd botdash

# Set permissions
sudo chown -R $USER:$USER /var/www/botdash
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd admin-panel
npm install
cd ..
```

### 3. Build Frontend

```bash
cd admin-panel
npm run build
cd ..
```

## Environment Configuration

### 1. Backend Environment

```bash
cd /var/www/botdash/backend
cp .env.example .env
nano .env
```

Add your configuration:

```env
# Database
DATABASE_URL=postgresql://botdash_user:your_secure_password_here@localhost:5432/botdash

# Telegram Bot
BOT_TOKEN=your_telegram_bot_token_from_botfather
BOT_USERNAME=your_bot_username_without_at

# Admin Panel
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=change_this_secure_password
ADMIN_JWT_SECRET=generate_long_random_string_here

# File uploads are stored locally in backend/uploads/ (no external service needed)

# Optional
DISABLE_TELEGRAM_AUTH=false
NODE_ENV=production
PORT=3001
```

### 2. Frontend Environment

```bash
cd /var/www/botdash/admin-panel
nano .env.local
```

Add your configuration:

```env
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

## Database Migration

```bash
cd /var/www/botdash/backend

# Run database migrations
npm run migrate

# Verify tables were created
psql -h localhost -U botdash_user -d botdash -c "\dt"
```

## Process Management with PM2

### 1. Create PM2 Ecosystem File

```bash
cd /var/www/botdash
nano ecosystem.config.js
```

Add the following configuration:

```javascript
module.exports = {
  apps: [
    {
      name: 'botdash-backend',
      cwd: '/var/www/botdash/backend',
      script: 'index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/pm2/botdash-backend-error.log',
      out_file: '/var/log/pm2/botdash-backend-out.log',
      log_file: '/var/log/pm2/botdash-backend.log',
      time: true
    },
    {
      name: 'botdash-frontend',
      cwd: '/var/www/botdash/admin-panel',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/botdash-frontend-error.log',
      out_file: '/var/log/pm2/botdash-frontend-out.log',
      log_file: '/var/log/pm2/botdash-frontend.log',
      time: true
    }
  ]
};
```

### 2. Create Log Directory

```bash
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2
```

### 3. Start Applications

```bash
# Start applications
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

### 4. Verify Applications

```bash
# Check status
pm2 status

# Check logs
pm2 logs

# Monitor
pm2 monit
```

## Nginx Configuration

### 1. Create Nginx Site Configuration

```bash
sudo nano /etc/nginx/sites-available/botdash
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Frontend (Next.js)
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
        proxy_read_timeout 86400;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Handle Next.js static files
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
}
```

### 2. Enable Site Configuration

```bash
# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Enable botdash site
sudo ln -s /etc/nginx/sites-available/botdash /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## SSL Certificate Setup

### 1. Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Obtain SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts to:
- Enter email address
- Agree to terms
- Choose whether to share email
- Redirect HTTP to HTTPS (recommended)

### 3. Auto-Renewal Setup

```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job for auto-renewal
sudo crontab -e
```

Add this line:
```cron
0 12 * * * /usr/bin/certbot renew --quiet
```

## Firewall Configuration

```bash
# Allow SSH
sudo ufw allow ssh

# Allow Nginx
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## Docker Alternative

For easier deployment and management, you can use Docker:

### 1. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Create Docker Compose File

```bash
cd /var/www/botdash
nano docker-compose.yml
```

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: botdash-db
    environment:
      POSTGRES_DB: botdash
      POSTGRES_USER: botdash_user
      POSTGRES_PASSWORD: your_secure_password_here
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    container_name: botdash-backend
    environment:
      - DATABASE_URL=postgresql://botdash_user:your_secure_password_here@postgres:5432/botdash
      - BOT_TOKEN=${BOT_TOKEN}
      - BOT_USERNAME=${BOT_USERNAME}
      - DEFAULT_ADMIN_USERNAME=${DEFAULT_ADMIN_USERNAME}
      - DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}
      - ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET}
      - NODE_ENV=production
      - PORT=3001
    ports:
      - "3001:3001"
    depends_on:
      - postgres
    restart: unless-stopped

  frontend:
    build: 
      context: ./admin-panel
      dockerfile: Dockerfile
    container_name: botdash-frontend
    environment:
      - NEXT_PUBLIC_API_URL=https://your-domain.com/api
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: botdash-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
```

### 3. Create Dockerfiles

**Backend Dockerfile** (`backend/Dockerfile`):
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run migrate

EXPOSE 3001

CMD ["npm", "start"]
```

**Frontend Dockerfile** (`admin-panel/Dockerfile`):
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
```

### 4. Deploy with Docker

```bash
# Create environment file
echo "BOT_TOKEN=your_bot_token" > .env
echo "BOT_USERNAME=your_bot_username" >> .env
echo "DEFAULT_ADMIN_USERNAME=admin" >> .env
echo "DEFAULT_ADMIN_PASSWORD=secure_password" >> .env
echo "ADMIN_JWT_SECRET=your_jwt_secret" >> .env

# Build and start containers
docker-compose up -d --build

# Check logs
docker-compose logs -f
```

## Monitoring and Maintenance

### 1. Check Application Status

```bash
# PM2 status
pm2 status

# Check logs
pm2 logs botdash-backend
pm2 logs botdash-frontend

# System resources
htop
df -h
free -h
```

### 2. Update Application

```bash
cd /var/www/botdash

# Pull latest changes
git pull origin main

# Install new dependencies
npm install
cd backend && npm install && cd ..
cd admin-panel && npm install && npm run build && cd ..

# Restart applications
pm2 restart all
```

### 3. Database Backup

```bash
# Create backup script
sudo nano /usr/local/bin/backup-botdash.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/botdash"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="botdash"
DB_USER="botdash_user"

mkdir -p $BACKUP_DIR

# Database backup
pg_dump -h localhost -U $DB_USER -d $DB_NAME > $BACKUP_DIR/botdash_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/botdash_$DATE.sql

# Remove old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/botdash_$DATE.sql.gz"
```

```bash
# Make script executable
sudo chmod +x /usr/local/bin/backup-botdash.sh

# Add to cron (daily at 2 AM)
sudo crontab -e
```

Add:
```cron
0 2 * * * /usr/local/bin/backup-botdash.sh
```

### 4. Log Rotation

```bash
sudo nano /etc/logrotate.d/pm2-botdash
```

```
/var/log/pm2/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
```

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check PM2 logs
pm2 logs

# Check if ports are in use
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :3001

# Check Node.js version
node --version  # Should be 20+
```

#### 2. Database Connection Issues

```bash
# Test database connection
psql -h localhost -U botdash_user -d botdash -c "SELECT version();"

# Check PostgreSQL status
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### 3. Nginx Issues

```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx status
sudo systemctl status nginx

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

#### 4. SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check Nginx SSL configuration
sudo nginx -t
```

### Performance Optimization

#### 1. Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
```

#### 2. Nginx Caching

Add to your Nginx configuration:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

#### 3. PM2 Cluster Mode

Your `ecosystem.config.js` already uses cluster mode for the backend. Monitor CPU usage and adjust instances if needed.

