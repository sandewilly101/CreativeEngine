import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = (key, fallback) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) throw new Error(`Missing required env var: ${key}`);
  return value;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  db: {
    host: required('DB_HOST', 'localhost'),
    port: Number(required('DB_PORT', '3306')),
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD ?? '',
    database: required('DB_NAME', 'creative_engine'),
    connectionLimit: Number(process.env.DB_POOL || 10),
  },

  jwt: {
    secret: required('JWT_SECRET', 'change-me-in-production-please-use-a-long-random-string'),
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '2h',
    refreshExpiryDays: Number(process.env.JWT_REFRESH_DAYS || 30),
  },

  uploads: {
    dir: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads'),
    maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 50),
    publicPath: '/uploads',
  },

  finance: {
    baseCurrency: 'TZS',
    vatRate: Number(process.env.VAT_RATE || 18),
    // Two independent providers; the second is a fallback if the first is down.
    fxPrimaryUrl: 'https://open.er-api.com/v6/latest/USD',
    fxFallbackUrl: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    fxRefreshHours: Number(process.env.FX_REFRESH_HOURS || 12),
  },

  ai: {
    provider: process.env.AI_PROVIDER || 'anthropic',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'claude-sonnet-5',
    apiUrl: process.env.AI_API_URL || 'https://api.anthropic.com/v1/messages',
  },
};

export const isProd = config.env === 'production';
