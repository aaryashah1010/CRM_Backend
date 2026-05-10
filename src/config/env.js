'use strict';

require('dotenv').config();

const required = [
  'JWT_ACCESS_SECRET',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[Config] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const toBool = (v, fallback = false) => {
  if (v === undefined || v === null || v === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(v).toLowerCase());
};

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,

  db: {
    server:   process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT, 10) || 1433,
    database: process.env.DB_NAME     || 'erp_crm',
    user:     process.env.DB_USER     || 'sa',
    password: process.env.DB_PASSWORD || '',
    options: {
      encrypt:                toBool(process.env.DB_ENCRYPT, false),
      trustServerCertificate: toBool(process.env.DB_TRUST_SERVER_CERTIFICATE, true),
      enableArithAbort:       true,
    },
    pool: {
      max:               parseInt(process.env.DB_POOL_MAX, 10)          || 10,
      min:               parseInt(process.env.DB_POOL_MIN, 10)          || 0,
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || 30000,
    },
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 15000,
    requestTimeout:    parseInt(process.env.DB_REQUEST_TIMEOUT, 10)    || 15000,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '8h',
  },

  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:4200').split(',').map((o) => o.trim()),
  logLevel: process.env.LOG_LEVEL || 'info',

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
};

module.exports = env;
