require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const pool = require('./config/database');
const { createBot } = require('./bot');
const { logger, logHelper } = require('./config/logger');

// Initialize Express app
const app = express();

// Log application startup
logger.info('Starting Dashbot Backend Server', {
  nodeVersion: process.version,
  environment: process.env.NODE_ENV || 'development',
  timestamp: new Date().toISOString()
});

// Optional: run database migrations on startup (use with care in production)
console.log('Requiring migrations...');
const { applyMigrations } = require('./migrations');

// Import admin routes
console.log('Requiring admin routes...');
let adminRoutes;
try {
  adminRoutes = require('./admin/routes');
  console.log('Admin routes loaded successfully.');
} catch (error) {
  console.error('CRITICAL ERROR loading admin routes:', error);
  // Keep going to see if app starts without them or if it exits here
}

// Import optimized auth middleware
const { validateTelegramWebAppData, getCacheStats, invalidateUserCache } = require('./middleware/optimized-auth');

console.log('Initializing app theme...');
// Modern color theme based on Telegram's native palette
const appTheme = {
  primary: '#5288c1',      // Button color <mcreference link="https://docs.telegram-mini-apps.com/platform/theming" index="4">4</mcreference>
  secondary: '#232e3c',    // Secondary background
  background: '#17212b',   // Main background
  text: '#f5f5f5',         // Main text color
  accentText: '#6ab2f2',   // Accent text
  destructive: '#ec3942',  // Error/delete actions
  hint: '#708499',         // Subtle text
  link: '#6ab3f3',         // Links and actions
  sectionBg: '#17212b',    // Section backgrounds
  headerBg: '#17212b',     // Header background
};

// Database configuration - using shared pool
// (pool is now imported from ./config/database)

// Log database connection
pool.on('connect', (client) => {
  logger.info('Database connection established', {
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432
  });
});

pool.on('error', (err, client) => {
  logger.error('Database connection error', {
    error: err.message,
    stack: err.stack
  });
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('Database connection test failed', {
      error: err.message,
      stack: err.stack
    });
  } else {
    logger.info('Database connection test successful', {
      serverTime: res.rows[0].now
    });
  }
});

// Generate a random referral code
const generateReferralCode = (length = 8) => {
  // Generate a random buffer
  const buffer = crypto.randomBytes(length);
  // Convert to a base64 string and remove non-alphanumeric characters
  return buffer.toString('base64')
    .replace(/[+/=]/g, '') // Remove non-alphanumeric characters
    .substring(0, length)  // Ensure consistent length
    .toUpperCase();        // Convert to uppercase for better readability
};

// Middleware
app.use(logHelper.logRequest); // Add request logging middleware

// Add timeout middleware
app.use((req, res, next) => {
  req.setTimeout(10000); // 10 second timeout
  res.setTimeout(10000);
  next();
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Init-Data', 'X-Telegram-Hash', 'x-admin-token'],
  credentials: true
}));
app.use(express.json({ limit: '1mb' })); // Limit payload size
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // Handle form data

console.log('Mounting routes...');
// Serve uploaded files from local storage
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize admin roles removed
// const { initializeAdminRoles } = require('./admin/initialize');

// Use admin routes
app.use('/admin', adminRoutes);
app.use('/admin/upload', require('./admin/upload'));
app.use('/admin/dashboard-stats', require('./admin/dashboard-stats'));
app.use('/admin/channel-verification', require('./admin/channel-verification'));
// Roles and Staff routes removed

// Cache stats endpoint for monitoring
app.get('/api/cache-stats', (req, res) => {
  res.json(getCacheStats());
});

// Cache invalidation endpoint (for admin use)
app.post('/api/invalidate-cache/:userId', (req, res) => {
  const userId = req.params.userId;
  if (userId) {
    invalidateUserCache(userId);
    res.json({ message: `Cache invalidated for user ${userId}` });
  } else {
    res.status(400).json({ message: 'User ID required' });
  }
});

// API Routes
app.get('/theme', (req, res) => {
  res.json(appTheme);
});

// Protected routes using Telegram authentication (skip payments which handle their own auth)
// NOTE: We use the wrapper middleware so missing BOT_TOKEN doesn't crash the server.
const telegramAuth = require('./middleware/auth');
app.use('/api', (req, res, next) => {
  return telegramAuth(req, res, next);
});

// Add telegram channels router


// Add users router
app.use('/api/users', require('./api/users'));

// Add settings router
app.use('/api/settings', require('./api/settings'));

// Add new feature routes
app.use('/api/upload', require('./api/upload'));

// User registration endpoint
app.post('/api/user/register', async (req, res) => {
  try {
    // User data is already validated and inserted by the middleware
    if (!req.telegramUser) {
      return res.status(400).json({ message: 'Invalid user data' });
    }

    // Fetch user points and other data
    const userDataResult = await pool.query(
      'SELECT id, username, first_name, last_name, points, referral_code, photo_url, created_at, is_banned, is_premium, premium_until, phone_number, email FROM telegram_users WHERE id = $1',
      [req.telegramUser.id]
    );

    const userData = userDataResult.rows[0];

    // If there's no referral code yet, generate one
    if (!userData.referral_code) {
      let referralCode;
      let isCodeUnique = false;

      // Keep generating codes until we find a unique one
      while (!isCodeUnique) {
        referralCode = generateReferralCode();

        // Check if the code already exists
        const existingCode = await pool.query(
          'SELECT COUNT(*) FROM telegram_users WHERE referral_code = $1',
          [referralCode]
        );

        if (parseInt(existingCode.rows[0].count) === 0) {
          isCodeUnique = true;
        }
      }

      await pool.query(
        'UPDATE telegram_users SET referral_code = $1 WHERE id = $2',
        [referralCode, req.telegramUser.id]
      );
      userData.referral_code = referralCode;
    }

    res.status(200).json({
      user: userData,
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// User task summary endpoint - OPTIMIZED
app.get('/api/user/task-summary', async (req, res) => {
  try {
    const userId = req.telegramUser?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Single optimized query to get all task data at once
    const result = await pool.query(
      `SELECT 0 as total_channels, 0 as completed_channels`
    );

    const data = result.rows[0] || { total_channels: 0, completed_channels: 0 };

    res.json({
      telegram_channels: {
        total: parseInt(data.total_channels),
        completed: parseInt(data.completed_channels),
        left: parseInt(data.total_channels) - parseInt(data.completed_channels)
      }
    });
  } catch (error) {
    console.error('Error in /api/user/task-summary:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logHelper.logSecurity('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.telegramUser?.id,
    body: req.body
  });

  // Log the error
  logger.error('Unhandled application error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.telegramUser?.id
  });

  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server and bot
const PORT = process.env.PORT || 3000;

console.log('Invoking IIFE...');
(async () => {
  let bot = null;

  // Optionally apply SQL migrations before the app starts serving requests.
  // Recommended approach on Railway:
  // - Temporarily set RUN_MIGRATIONS=true
  // - Deploy once and watch logs until migrations complete
  // - Then set RUN_MIGRATIONS=false (or remove)
  if (String(process.env.RUN_MIGRATIONS).toLowerCase() === 'true') {
    logger.warn('RUN_MIGRATIONS=true: applying pending SQL migrations');
    await applyMigrations();
  }

  // Start the server first so deployments don't crash just because optional integrations
  // (like the Telegram bot token) are not configured.
  app.listen(PORT, () => {
    logger.info('Server started successfully', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  });

  try {
    // createBot() now fully initializes and starts the bot (polling mode).
    // No need to call start() again here.
    bot = await createBot();

    logger.info('Telegram bot started successfully', {
      botToken: process.env.BOT_TOKEN ? '[REDACTED]' : 'NOT_SET',
      apiId: process.env.API_ID ? '[REDACTED]' : 'NOT_SET'
    });
  } catch (error) {
    // Do NOT crash the whole server if the bot cannot start.
    logger.error('Telegram bot failed to start (server will continue without bot)', {
      error: error.message,
      stack: error.stack
    });
  }

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    try {
      if (bot && typeof bot.stop === 'function') await bot.stop();
    } finally {
      process.exit(0);
    }
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    try {
      if (bot && typeof bot.stop === 'function') await bot.stop();
    } finally {
      process.exit(0);
    }
  });
})();