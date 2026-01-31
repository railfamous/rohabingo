# BotDash Plesk GitHub Installation Guide

This guide provides step-by-step instructions for deploying BotDash from GitHub to a Plesk-controlled server.


## 📋 Prerequisites

### Server Requirements
- Plesk control panel (Obsidian or later)
- Node.js support enabled in Plesk
- PostgreSQL or MySQL database
- SSH access (recommended)
- Domain name configured in Plesk

### GitHub Requirements
- GitHub repository URL
- Git access (public repo or SSH keys for private)

## 🛠️ Step 1: Plesk Server Setup

### 1.1 Enable Node.js Support

1. Log in to Plesk as admin
2. Go to **Tools & Settings** → **Updates**
3. Click **Add/Remove Components**
4. Under **Web hosting**, check **Node.js support**
5. Click **Continue** → **Continue** to install

### 1.2 Verify Installation

1. Go to **Tools & Settings** → **Server Components**
2. Verify Node.js is listed (version 18+ recommended)
3. Note the available Node.js versions

### 1.3 Database Setup

#### PostgreSQL (Recommended)
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

#### MySQL/MariaDB (Alternative)
1. Usually pre-installed in Plesk
2. Go to **Tools & Settings** → **Database Servers**
3. Note the connection details

## 🌐 Step 2: Create Subscription and Domain

### 2.1 Create Subscription

1. In Plesk, go to **Subscriptions**
2. Click **Add Subscription**
3. Configure:
   - **Domain name**: your-domain.com
   - **IP address**: [select available IP]
   - **Performance**: [select appropriate plan]
4. Click **Continue**
5. Set **Administrator username** and **password**
6. Click **Finish**

### 2.2 Configure Domain

1. Go to **Websites & Domains** → your domain
2. Click **Hosting Settings**
3. Configure:
   - **Document root**: /httpdocs
   - **PHP version**: [select latest]
   - **Access to server over SSH**: [enable]
4. Click **OK**

## 📥 Step 3: Deploy from GitHub

### 3.1 Add Git Repository

1. Go to **Websites & Domains** → your domain
2. Click **Git** in the left panel
3. Click **Add Repository**
4. Configure Git settings:

```
Repository URL: https://github.com/your-username/BotDash.git
Repository branch: main
Deployment path: httpdocs
Deployment mode: Manual deploy
```

5. Click **OK**

### 3.2 Pull Repository

1. Click on your repository
2. Click **Pull Updates**
3. Wait for the repository to be cloned
4. Verify files appear in File Manager

### 3.3 Set File Permissions

1. Go to **File Manager**
2. Select all files and folders
3. Right-click → **Change Permissions**
4. Set permissions:
   - **Owner**: Read, Write, Execute
   - **Group**: Read, Execute  
   - **Others**: Read, Execute
5. Click **OK**

## 🗄️ Step 4: Database Configuration

### 4.1 Create Database

1. Go to **Websites & Domains** → your domain
2. Click **Databases**
3. Click **Add Database**
4. Configure:
   - **Database name**: botdash
   - **Database server**: [select PostgreSQL]
   - **Database user**: botdash_user
   - **Password**: [generate strong password]
5. Click **OK**

### 4.2 Import Database Schema

1. In File Manager, navigate to `backend`
2. Find `schema.sql`
3. Go to **Databases** → your database
4. Click **Import Dump**
5. Upload `schema.sql`
6. Wait for import to complete

## ⚙️ Step 5: Environment Configuration

### 5.1 Backend Environment

1. In File Manager, navigate to `backend`
2. Create new file: `.env`
3. Add the following configuration:

```env
# Database Configuration
DATABASE_URL=postgresql://botdash_user:your_database_password@localhost:5432/botdash

# Telegram Bot Configuration
BOT_TOKEN=your_telegram_bot_token_from_botfather
BOT_USERNAME=your_bot_username_without_at
DISABLE_TELEGRAM_AUTH=false

# Admin Panel Login
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=your_secure_admin_password
ADMIN_JWT_SECRET=your_very_long_random_secret_key_here

# Supabase Configuration 
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Server Configuration
NODE_ENV=production
PORT=3000
```

### 5.2 Frontend Environment

1. In File Manager, navigate to `admin-panel`
2. Create new file: `.env.local`
3. Add:

```env
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

## 🔧 Step 6: Node.js Application Setup

### 6.1 Configure Node.js

1. Go to **Websites & Domains** → your domain
2. Click **Node.js**
3. Configure settings:

```
Node.js version: 20.x (or latest available)
Application root: /httpdocs/backend
Application startup file: index.js
Application URL: https://your-domain.com
Custom document root: /httpdocs/admin-panel
```

4. Add Environment Variables:
   - Click **Environment variables**
   - Add the same variables from `.env` file

5. Click **OK**
6. Click **Enable Node.js**

### 6.2 Install Dependencies

#### Option A: Via SSH (Recommended)

1. Connect via SSH:
   ```bash
   ssh username@your-server-ip
   cd /var/www/vhosts/your-domain.com/httpdocs/backend
   npm install --production
   cd ../admin-panel
   npm install --production
   npm run build
   ```

#### Option B: Via Plesk File Manager

1. Open File Manager
2. Navigate to `backend`
3. Use Plesk's "Console" feature to run:
   ```bash
   npm install --production
   ```

### 6.3 Run Database Migrations

1. Via SSH or Plesk Console:
   ```bash
   cd /var/www/vhosts/your-domain.com/httpdocs/backend
   npm run migrate
   ```

### 6.4 Start Application

1. In Node.js settings, click **Restart App**
2. Check application status
3. Verify no errors in logs

## 🌐 Step 7: Web Server Configuration

### 7.1 Configure Nginx Proxy

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

5. Click **OK**
6. Click **Apply**

## 🔒 Step 8: SSL Certificate Setup

### 8.1 Install Let's Encrypt Certificate

1. Go to **Websites & Domains** → your domain
2. Click **SSL/TLS Certificates**
3. Click **Add SSL Certificate**
4. Choose **Let's Encrypt**
5. Configure:
   - Check **Secure the domain with a free Let's Encrypt certificate**
   - Check **Issue a wildcard certificate**
   - Enter your email address
6. Click **Get it Free**
7. Wait for certificate issuance

### 8.2 Enable HTTPS

1. Go to **Websites & Domains** → your domain
2. Click **Hosting Settings**
3. Under **Security**:
   - Check **SSL/TLS support**
   - Select your SSL certificate
   - Check **Permanent SEO-safe 301 redirect**
4. Click **OK**

## 🧪 Step 9: Testing and Verification

### 9.1 Test Backend

1. Open browser: `https://your-domain.com/api/health`
2. Should return: `{"status":"OK",...}`

### 9.2 Test Frontend

1. Open browser: `https://your-domain.com`
2. Should see admin panel login page
3. Test login with your configured credentials

### 9.3 Check Logs

1. Go to **Websites & Domains** → your domain
2. Click **Logs**
3. Check for any errors
4. Monitor Node.js application logs

## 🔄 Step 10: Updates and Maintenance

### 10.1 Update from GitHub

1. Go to **Git** → your repository
2. Click **Pull Updates**
3. Wait for updates to download
4. Restart Node.js application

### 10.2 Database Backups

1. Go to **Websites & Domains** → your domain
2. Click **Scheduled Tasks**
3. Click **Add Task**
4. Configure:
   - **Task type**: Run a command
   - **Command**: `pg_dump -h localhost -U botdash_user botdash > /var/www/vhosts/your-domain.com/backups/botdash_$(date +\%Y\%m\%d_\%H\%M\%S).sql`
   - **Run**: Daily
   - **Time**: 02:00
5. Click **OK**

## 🐛 Troubleshooting

### Common Issues

#### Application Won't Start
1. Check Node.js logs in Plesk
2. Verify environment variables
3. Check database connection
4. Ensure all dependencies are installed

#### Database Connection Issues
1. Verify database credentials
2. Test connection via Plesk Database Manager
3. Check PostgreSQL service status

#### Permission Issues
1. Reset file permissions via File Manager
2. Ensure correct ownership
3. Check Node.js process permissions

#### Frontend Not Loading
1. Verify build process completed
2. Check NEXT_PUBLIC_API_URL
3. Ensure proxy rules are correct

### Getting Help

1. Check Plesk logs: **Tools & Settings** → **Log Manager**
2. Verify all configurations match this guide
3. Test database connectivity
4. Check Node.js application logs
5. Contact your hosting provider for server-level issues

## 📚 Additional Configuration

### Performance Optimization

Add to nginx directives:
```nginx
# Enable caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript;
```

### Security Hardening

1. Enable firewall in Plesk
2. Use strong passwords
3. Regular updates
4. Monitor access logs
5. Set up fail2ban if available

## 🎉 Deployment Complete

Your BotDash application is now deployed from GitHub to your Plesk server!

### Final Checklist

- [ ] Backend running and accessible
- [ ] Frontend loading correctly
- [ ] Database migrations applied
- [ ] SSL certificate installed
- [ ] Login functionality working
- [ ] Backup schedule configured
- [ ] Monitoring enabled

