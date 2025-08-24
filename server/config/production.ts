// Production configuration
export const productionConfig = {
  // Security settings
  security: {
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiry: '24h',
    bcryptRounds: 12,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Database configuration
  database: {
    url: process.env.DATABASE_URL!,
    maxConnections: 20,
    connectionTimeout: 30000,
    idleTimeout: 10000,
    ssl: {
      rejectUnauthorized: false // For Neon database
    }
  },

  // Email configuration
  email: {
    apiKey: process.env.SENDGRID_API_KEY!,
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@houseguide.app',
    templates: {
      verification: 'verify-email',
      passwordReset: 'reset-password',
      weeklyReport: 'weekly-report'
    }
  },

  // Storage configuration  
  storage: {
    provider: 'gcs', // Google Cloud Storage
    bucket: process.env.STORAGE_BUCKET || 'houseguide-production',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain'
    ]
  },

  // Rate limiting
  rateLimiting: {
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 5
    },
    api: {
      windowMs: 1 * 60 * 1000,
      max: 100
    },
    uploads: {
      windowMs: 5 * 60 * 1000,
      max: 10
    }
  },

  // Monitoring and logging
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    logLevel: 'info',
    metricsInterval: 60000, // 1 minute
    healthCheckInterval: 30000, // 30 seconds
    alerting: {
      enabled: true,
      channels: ['email', 'slack'],
      thresholds: {
        errorRate: 10, // errors per minute
        responseTime: 1000, // ms
        memoryUsage: 90, // percent
        cpuUsage: 80 // percent
      }
    }
  },

  // CORS configuration
  cors: {
    origin: process.env.FRONTEND_URL!,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    maxAge: 86400 // 24 hours
  },

  // Cache configuration
  cache: {
    redis: {
      url: process.env.REDIS_URL,
      ttl: 3600, // 1 hour default
      keyPrefix: 'houseguide:'
    },
    cdn: {
      enabled: true,
      provider: 'cloudflare',
      purgeOnDeploy: true
    }
  },

  // Feature flags
  features: {
    maintenanceMode: false,
    newOnboarding: true,
    advancedReporting: true,
    aiAssistant: false,
    multiFactorAuth: false
  },

  // Performance settings
  performance: {
    enableCompression: true,
    enableCaching: true,
    staticAssetMaxAge: 31536000, // 1 year
    apiTimeout: 30000, // 30 seconds
    uploadTimeout: 120000, // 2 minutes
    queryTimeout: 10000 // 10 seconds
  },

  // Backup configuration
  backup: {
    enabled: true,
    schedule: '0 2 * * *', // Daily at 2 AM
    retention: {
      daily: 7,
      weekly: 4,
      monthly: 3
    },
    destinations: ['gcs', 's3']
  }
};

// Validate required environment variables
export function validateProductionConfig() {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'SENDGRID_API_KEY',
    'FRONTEND_URL'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT secret strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('WARNING: JWT_SECRET should be at least 32 characters for production');
  }

  return true;
}