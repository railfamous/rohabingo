# BotDash Plesk Deployment Guide

This guide provides step-by-step instructions for deploying BotDash on a Plesk-controlled server.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Plesk Server Setup](#plesk-server-setup)
- [Method 1: GitHub Repository Deployment](#method-1-github-repository-deployment)
- [Method 2: File Upload Deployment](#method-2-file-upload-deployment)
- [Database Configuration](#database-configuration)
- [Environment Variables Setup](#environment-variables-setup)
- [Node.js Application Configuration](#nodejs-application-configuration)
- [Domain and SSL Setup](#domain-and-ssl-setup)
- [Final Steps](#final-steps)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Plesk control panel access (admin or reseller)
- Domain name configured in Plesk
- SSH access to server (optional but recommended)
- Node.js support in Plesk
- PostgreSQL database or MySQL/MariaDB
- Git repository URL (if using Method 1)

## Plesk Server Setup

### 1. Enable Node.js Support

1. Log in to Plesk
2. Go to **Tools & Settings** → **Updates**
3. Click **Add/Remove Components**
4. Under **Web hosting**, ensure **Node.js support** is checked
5. Click **Continue** → **Continue** to install

### 2. Verify Node.js Installation

1. Go to **Tools & Settings** → **Server Components**
2. Verify Node.js is listed and active
3. Note the Node.js version available (should be 18+)

### 3. Database Setup

#### Option A: PostgreSQL (Recommended)

1. Go to **Tools & Settings** → **Database Servers**
2. Click **Add Database Server**
3. Select **PostgreSQL**
4. Configure:
   - **Database server name**: PostgreSQL
   - **IP address**: localhost
   - **Port**: 5432
   - **Administrator username**: postgres
   - **Administrator password**: [set secure password]
5. Click **OK**



## Method 1: GitHub Repository Deployment

### Step 1: Create Subscription and Domain

1. In Plesk, go to **Subscriptions**
2. Click **Add Subscription**
3. Choose **Webspace**:
   - **Domain name**: your-domain.com
   - **IP address**: [select available IP]
   - **Performance**: [select appropriate plan]
4. Click **Continue**
5. Set **Administrator username** and **password**
6. Click **Finish**

### Step 2: Configure Git Repository

1. Go to your subscription → **Websites & Domains**
2. Click **Git** in the left panel
3. Click **Add Repository**
4. Configure Git settings:
   - **Repository URL**: https://github.com/your-username/BotDash.git
   - **Repository branch**: main
   - **Deployment path**: httpdocs
   - **Deployment mode**: Manual deploy
5. Click **OK**

### Step 3: Pull Repository

1. Click on your repository
2. Click **Pull Updates**
3. Wait for the repository to be cloned

### Step 4: Set Up Node.js Application

1. Go to **Websites & Domains** → your domain
2. Click **Node.js**
3. Configure Node.js settings:
   - **Node.js version**: 20.x (or latest available)
   - **Application root**: /httpdocs
   - **Application startup file**: backend/index.js
   - **Application URL**: http://your-domain.com
   - **Environment variables**: [add later]
4. Click **OK**
5. Click **Enable Node.js**
6. Click **Restart App**

## Method 2: File Upload Deployment

### Step 1: Create Subscription and Domain

Follow the same steps as Method 1 to create subscription and domain.

### Step 2: Download and Upload Project

1. On your local machine:
   ```bash
   # Clone the repository
   git clone https://github.com/your-username/BotDash.git
   cd BotDash
   
   # Create zip file
   zip -r BotDash.zip .
   ```

2. In Plesk:
   - Go to **Websites & Domains** → your domain
   - Click **File Manager**
   - Navigate to `httpdocs`
   - Delete any existing files
   - Click **Upload**
   - Select `BotDash.zip`
   - Right-click the zip file → **Extract**
   - Delete the zip file after extraction

### Step 3: Set File Permissions

1. In File Manager, select all files and folders
2. Right-click → **Change Permissions**
3. Set permissions:
   - **Owner**: Read, Write, Execute
   - **Group**: Read, Execute
   - **Others**: Read, Execute
4. Click **OK**

### Step 4: Set Up Node.js Application

Follow the same Node.js setup steps as in Method 1.

## Database Configuration

### Step 1: Create Database

1. Go to **Websites & Domains** → your domain
2. Click **Databases**
3. Click **Add Database**
4. Configure:
   - **Database name**: botdash
   - **Database server**: [select PostgreSQL or MySQL]
   - **Database user**: botdash_user
   - **Password**: [generate strong password]
5. Click **OK**

### Step 2: Import Schema (Optional)

1. In File Manager, navigate to `backend`
2. Find `schema.sql`
3. Go to **Databases** → your database
4. Click **Import Dump**
5. Upload `schema.sql`
6. Wait for import to complete

## Environment Variables Setup

### Step 1: Backend Environment

1. Go to **Websites & Domains** → your domain
2. Click **Node.js**
3. Scroll to **Environment variables**
4. Add the following variables:

```env
DATABASE_URL=postgresql://botdash_user:your_password@localhost:5432/botdash
BOT_TOKEN=your_telegram_bot_token
BOT_USERNAME=your_bot_username
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=secure_admin_password
ADMIN_JWT_SECRET=your_jwt_secret_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
```

### Step 2: Frontend Environment

1. In File Manager, navigate to `admin-panel`
2. Create new file: `.env.local`
3. Add:
```env
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

## Node.js Application Configuration

### Step 1: Backend Configuration

1. Go to **Node.js** settings
2. Update settings:
   - **Application root**: /httpdocs/backend
   - **Application startup file**: index.js
   - **Application URL**: https://your-domain.com
   - **Custom document root**: /httpdocs/admin-panel

### Step 2: Install Dependencies

1. Enable SSH access in Plesk (if not already enabled)
2. Connect via SSH:
   ```bash
   ssh username@your-server-ip
   cd /var/www/vhosts/your-domain.com/httpdocs
   
   # Install backend dependencies
   cd backend
   npm install --production
   
   # Install frontend dependencies
   cd ../admin-panel
   npm install --production
   npm run build
   ```

### Step 3: Run Database Migrations

```bash
cd /var/www/vhosts/your-domain.com/httpdocs/backend
npm run migrate
```

### Step 4: Configure Proxy Rules

1. Go to **Websites & Domains** → your domain
2. Click **Apache & nginx Settings**
3. Scroll to **Additional nginx directives**
4. Add:

```nginx
# Frontend proxy
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

# Backend API proxy
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
}
```

## Domain and SSL Setup

### Step 1: SSL Certificate

1. Go to **Websites & Domains** → your domain
2. Click **SSL/TLS Certificates**
3. Click **Add SSL Certificate**
4. Choose **Let's Encrypt** (recommended) or upload custom certificate
5. For Let's Encrypt:
   - Check **Secure the domain with a free Let's Encrypt certificate**
   - Check **Issue a wildcard certificate**
   - Enter your email
6. Click **Get it Free**
7. Wait for certificate issuance

### Step 2: Enable HTTPS

1. Go to **Websites & Domains** → your domain
2. Click **Hosting Settings**
3. Under **Security**, check **SSL/TLS support**
4. Select your SSL certificate
5. Check **Permanent SEO-safe 301 redirect**
6. Click **OK**

## Final Steps

### Step 1: Restart Services

1. Go to **Node.js** settings
2. Click **Restart App**
3. Check application status

### Step 2: Test Application

1. Open browser: `https://your-domain.com`
2. Should see the admin panel login
3. Test API: `https://your-domain.com/api/health`

### Step 3: Set Up Scheduled Tasks

1. Go to **Websites & Domains** → your domain
2. Click **Scheduled Tasks**
3. Click **Add Task**
4. Configure backup task:
   - **Task type**: Run a command
   - **Command**: `pg_dump -h localhost -U botdash_user botdash > /var/www/vhosts/your-domain.com/backups/botdash_$(date +\%Y\%m\%d_\%H\%M\%S).sql`
   - **Run**: Daily
   - **Time**: 02:00
5. Click **OK**

## Troubleshooting

### Common Issues

#### 1. Node.js Application Won't Start

**Symptoms**: 503 Bad Gateway error

**Solutions**:
1. Check Node.js logs:
   - Go to **Node.js** → **Logs**
   - Look for error messages

2. Verify dependencies:
   ```bash
   cd /var/www/vhosts/your-domain.com/httpdocs/backend
   npm install --production
   ```

3. Check environment variables:
   - Go to **Node.js** → **Environment variables**
   - Verify all required variables are set

#### 2. Database Connection Issues

**Symptoms**: Database connection errors in logs

**Solutions**:
1. Verify database credentials:
   - Go to **Databases** → your database
   - Check username and password

2. Test database connection:
   ```bash
   psql -h localhost -U botdash_user -d botdash -c "SELECT version();"
   ```

3. Update DATABASE_URL in environment variables

#### 3. Permission Issues

**Symptoms**: File permission errors

**Solutions**:
1. Reset file permissions:
   - In File Manager, select all files
   - Right-click → **Change Permissions**
   - Set appropriate permissions

2. Fix ownership via SSH:
   ```bash
   sudo chown -R username:psacln /var/www/vhosts/your-domain.com/httpdocs
   ```

#### 4. Frontend Not Loading

**Symptoms**: Blank page or loading errors

**Solutions**:
1. Check if frontend is built:
   ```bash
   cd /var/www/vhosts/your-domain.com/httpdocs/admin-panel
   npm run build
   ```

2. Verify NEXT_PUBLIC_API_URL in `.env.local`

3. Check nginx proxy rules

### Performance Optimization

#### 1. Enable Caching

Add to nginx directives:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

#### 2. Enable Gzip

Add to nginx directives:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

### Monitoring

#### 1. Application Monitoring

1. Go to **Websites & Domains** → your domain
2. Click **Logs**
3. Monitor access and error logs

#### 2. Resource Monitoring

1. Go to **Tools & Settings** → **Resource Usage**
2. Monitor CPU, memory, and disk usage

## Alternative: Docker Deployment in Plesk

If your Plesk supports Docker:

1. Go to **Tools & Settings** → **Docker**
2. Click **Install Docker**
3. Use the provided `docker-compose.yml` from the deployment folder
4. Deploy containers through Plesk interface

## Support

If you encounter issues:

1. Check Plesk logs: **Tools & Settings** → **Log Manager**
2. Verify all configurations match this guide
3. Test database connectivity
4. Check Node.js application logs
5. Contact your hosting provider if server-level issues persist

## Next Steps

After successful deployment:

1. Configure your Telegram bot token
2. Set up admin user accounts
3. Configure bot commands and flows
4. Set up regular backups
5. Monitor application performance
6. Set up SSL certificate renewal

Your BotDash application is now running on Plesk!
