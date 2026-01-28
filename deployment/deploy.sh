#!/bin/bash

# BotDash VPS Deployment Script
# This script automates the deployment process for BotDash on Ubuntu VPS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="your-domain.com"
PROJECT_PATH="/var/www/botdash"
DB_NAME="botdash"
DB_USER="botdash_user"

# Logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root. Run as regular user with sudo privileges."
    fi
}

# Update system
update_system() {
    log "Updating system packages..."
    sudo apt update && sudo apt upgrade -y
}

# Install dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    # Node.js 20
    if ! command -v node &> /dev/null; then
        log "Installing Node.js 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        log "Node.js already installed: $(node --version)"
    fi
    
    # PostgreSQL
    if ! command -v psql &> /dev/null; then
        log "Installing PostgreSQL..."
        sudo apt install postgresql postgresql-contrib -y
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    else
        log "PostgreSQL already installed"
    fi
    
    # Nginx
    if ! command -v nginx &> /dev/null; then
        log "Installing Nginx..."
        sudo apt install nginx -y
        sudo systemctl start nginx
        sudo systemctl enable nginx
    else
        log "Nginx already installed"
    fi
    
    # PM2
    if ! command -v pm2 &> /dev/null; then
        log "Installing PM2..."
        sudo npm install -g pm2
    else
        log "PM2 already installed"
    fi
    
    # Git
    if ! command -v git &> /dev/null; then
        log "Installing Git..."
        sudo apt install git -y
    else
        log "Git already installed"
    fi
}

# Setup database
setup_database() {
    log "Setting up PostgreSQL database..."
    
    # Check if database exists
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
        warn "Database '$DB_NAME' already exists"
    else
        log "Creating database and user..."
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD 'your_secure_password_here';"
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
        sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
        log "Database setup completed"
    fi
}

# Clone repository
clone_repository() {
    log "Setting up project directory..."
    
    if [ -d "$PROJECT_PATH" ]; then
        warn "Project directory already exists. Updating..."
        cd $PROJECT_PATH
        git pull origin main
    else
        log "Cloning repository..."
        sudo mkdir -p /var/www
        cd /var/www
        sudo git clone https://github.com/your-username/BotDash.git botdash
        sudo chown -R $USER:$USER $PROJECT_PATH
        cd $PROJECT_PATH
    fi
}

# Install dependencies
install_project_dependencies() {
    log "Installing project dependencies..."
    
    cd $PROJECT_PATH
    npm install
    
    cd backend
    npm install
    
    cd ../admin-panel
    npm install
    npm run build
    
    cd $PROJECT_PATH
}

# Setup environment files
setup_environment() {
    log "Setting up environment files..."
    
    # Backend environment
    if [ ! -f "$PROJECT_PATH/backend/.env" ]; then
        log "Creating backend .env file..."
        cp $PROJECT_PATH/backend/.env.example $PROJECT_PATH/backend/.env
        warn "Please edit $PROJECT_PATH/backend/.env with your configuration"
    else
        warn "Backend .env file already exists"
    fi
    
    # Frontend environment
    if [ ! -f "$PROJECT_PATH/admin-panel/.env.local" ]; then
        log "Creating frontend .env.local file..."
        echo "NEXT_PUBLIC_API_URL=https://$DOMAIN/api" > $PROJECT_PATH/admin-panel/.env.local
    else
        warn "Frontend .env.local file already exists"
    fi
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    cd $PROJECT_PATH/backend
    npm run migrate
}

# Setup PM2
setup_pm2() {
    log "Setting up PM2..."
    
    # Create log directory
    sudo mkdir -p /var/log/pm2
    sudo chown $USER:$USER /var/log/pm2
    
    # Copy ecosystem config
    cp $PROJECT_PATH/deployment/ecosystem.config.js $PROJECT_PATH/
    
    # Start applications
    cd $PROJECT_PATH
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup
}

# Setup Nginx
setup_nginx() {
    log "Setting up Nginx..."
    
    # Copy Nginx config
    sudo cp $PROJECT_PATH/deployment/nginx.conf /etc/nginx/sites-available/botdash
    
    # Replace domain placeholder
    sudo sed -i "s/your-domain.com/$DOMAIN/g" /etc/nginx/sites-available/botdash
    
    # Remove default site
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Enable site
    sudo ln -sf /etc/nginx/sites-available/botdash /etc/nginx/sites-enabled/
    
    # Test configuration
    sudo nginx -t
    
    # Restart Nginx
    sudo systemctl restart nginx
}

# Setup firewall
setup_firewall() {
    log "Setting up firewall..."
    
    sudo ufw allow ssh
    sudo ufw allow 'Nginx Full'
    echo "y" | sudo ufw enable
}

# Setup SSL
setup_ssl() {
    log "Setting up SSL certificate..."
    
    # Install Certbot
    sudo apt install certbot python3-certbot-nginx -y
    
    # Get SSL certificate
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect
    
    # Setup auto-renewal
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
}

# Setup backup script
setup_backup() {
    log "Setting up backup script..."
    
    sudo tee /usr/local/bin/backup-botdash.sh > /dev/null <<EOF
#!/bin/bash
BACKUP_DIR="/var/backups/botdash"
DATE=\$(date +%Y%m%d_%H%M%S)
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"

mkdir -p \$BACKUP_DIR

# Database backup
pg_dump -h localhost -U \$DB_USER -d \$DB_NAME > \$BACKUP_DIR/botdash_\$DATE.sql

# Compress backup
gzip \$BACKUP_DIR/botdash_\$DATE.sql

# Remove old backups (keep last 7 days)
find \$BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: \$BACKUP_DIR/botdash_\$DATE.sql.gz"
EOF
    
    sudo chmod +x /usr/local/bin/backup-botdash.sh
    
    # Add to cron
    (echo "0 2 * * * /usr/local/bin/backup-botdash.sh") | sudo crontab -
}

# Main deployment function
main() {
    log "Starting BotDash deployment..."
    
    # Check requirements
    check_root
    
    # Get domain from user if not set
    if [ "$DOMAIN" = "your-domain.com" ]; then
        read -p "Enter your domain name: " DOMAIN
        if [ -z "$DOMAIN" ]; then
            error "Domain name is required"
        fi
    fi
    
    # Run deployment steps
    update_system
    install_dependencies
    setup_database
    clone_repository
    install_project_dependencies
    setup_environment
    run_migrations
    setup_pm2
    setup_nginx
    setup_firewall
    setup_ssl
    setup_backup
    
    log "Deployment completed successfully!"
    log "Your BotDash application is now available at: https://$DOMAIN"
    log ""
    log "Next steps:"
    log "1. Edit $PROJECT_PATH/backend/.env with your configuration"
    log "2. Restart PM2: pm2 restart all"
    log "3. Check logs: pm2 logs"
    log "4. Setup your Telegram bot token"
    log ""
    log "Useful commands:"
    log "- Check status: pm2 status"
    log "- View logs: pm2 logs"
    log "- Restart apps: pm2 restart all"
    log "- Update: cd $PROJECT_PATH && git pull && pm2 restart all"
}

# Run main function
main "$@"
