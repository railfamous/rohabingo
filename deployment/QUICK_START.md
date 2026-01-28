# BotDash Quick Start Deployment Guide

This guide provides the fastest way to deploy BotDash on your VPS.

## 🚀 One-Click Deployment

### Option 1: Automated Script (Recommended)

1. **Connect to your VPS:**
   ```bash
   ssh root@your-vps-ip
   ```

2. **Create a non-root user:**
   ```bash
   adduser botdash
   usermod -aG sudo botdash
   su - botdash
   ```

3. **Download and run the deployment script:**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/your-username/BotDash/main/deployment/deploy.sh -o deploy.sh
   chmod +x deploy.sh
   ./deploy.sh
   ```

4. **Follow the prompts** - the script will handle everything automatically!

### Option 2: Manual Quick Setup

1. **Update system:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Install dependencies:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs postgresql postgresql-contrib nginx
   sudo npm install -g pm2
   ```

3. **Setup database:**
   ```bash
   sudo -u postgres psql -c "CREATE DATABASE botdash; CREATE USER botdash_user WITH PASSWORD 'your_password'; GRANT ALL PRIVILEGES ON DATABASE botdash TO botdash_user;"
   ```

4. **Clone and deploy:**
   ```bash
   cd /var/www
   sudo git clone https://github.com/your-username/BotDash.git botdash
   sudo chown -R $USER:$USER botdash
   cd botdash
   npm install && cd backend && npm install && cd ../admin-panel && npm install && npm run build && cd ..
   ```

5. **Configure environment:**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your settings
   echo "NEXT_PUBLIC_API_URL=https://your-domain.com/api" > admin-panel/.env.local
   ```

6. **Start services:**
   ```bash
   cd backend && npm run migrate && cd ..
   pm2 start deployment/ecosystem.config.js
   sudo cp deployment/nginx.conf /etc/nginx/sites-available/botdash
   sudo sed -i 's/your-domain.com/your-domain.com/g' /etc/nginx/sites-available/botdash
   sudo ln -s /etc/nginx/sites-available/botdash /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   sudo nginx -t && sudo systemctl restart nginx
   ```

7. **Setup SSL:**
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d your-domain.com -d www.your-domain.com
   ```

## 📋 Prerequisites

- Ubuntu 20.04+ VPS (Hostinger, DigitalOcean, etc.)
- Domain name pointed to your VPS
- SSH access

## 🔧 Required Configuration

Before deploying, you'll need:

1. **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)
2. **Domain name** (e.g., yourdomain.com)
3. **Database password** (generate a strong one)

## 🌐 Access Your Application

After deployment:

- **Admin Panel**: `https://your-domain.com`
- **API**: `https://your-domain.com/api`
- **Default Login**: 
  - Username: `admin`
  - Password: (what you set in .env)

## 🔍 Verify Deployment

Check if everything is working:

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs

# Test API
curl https://your-domain.com/api/health

# Check Nginx status
sudo systemctl status nginx
```

## 🛠️ Common Commands

```bash
# Restart applications
pm2 restart all

# View logs
pm2 logs botdash-backend
pm2 logs botdash-frontend

# Update application
cd /var/www/botdash
git pull
npm install
cd backend && npm install && cd ..
cd admin-panel && npm install && npm run build && cd ..
pm2 restart all

# Database backup
pg_dump -h localhost -U botdash_user -d botdash > backup.sql
```

## 🐛 Troubleshooting

### Application won't start
```bash
# Check logs
pm2 logs

# Check ports
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :3001
```

### Database issues
```bash
# Test connection
psql -h localhost -U botdash_user -d botdash -c "SELECT version();"

# Check PostgreSQL status
sudo systemctl status postgresql
```

### Nginx issues
```bash
# Test configuration
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log
```

## 🔒 Security Tips

1. **Change default passwords** immediately
2. **Keep system updated**: `sudo apt update && sudo apt upgrade -y`
3. **Use strong passwords** for database and admin
4. **Enable firewall**: `sudo ufw enable`
5. **Regular backups**: Set up automated backups

## 📚 Next Steps

1. Configure your Telegram bot token
2. Set up Supabase for file uploads
3. Configure your bot commands and flows
4. Set up monitoring and alerts
5. Configure custom domain settings

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs: `pm2 logs`, `sudo journalctl -u nginx`
3. Verify all environment variables are set
4. Check network connectivity and ports

For detailed documentation, see the full [README.md](./README.md).
