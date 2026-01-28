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
      out_file: '/var/log/pm2/botdash-frontend-out.log',
      log_file: '/var/log/pm2/botdash-backend.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024'
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
      time: true,
      max_memory_restart: '512M',
      node_args: '--max-old-space-size=512'
    }
  ]
};
