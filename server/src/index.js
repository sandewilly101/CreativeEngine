import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { config, isProd } from './config/env.js';
import { testConnection } from './config/db.js';
import { startFxScheduler } from './services/fxService.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import mediaRoutes from './routes/media.js';
import resourceRoutes from './routes/resources.js';
import quoteRoutes from './routes/quotes.js';
import invoiceRoutes from './routes/invoices.js';
import projectRoutes from './routes/projects.js';
import bookingRoutes from './routes/bookings.js';
import printRoutes from './routes/printOrders.js';
import dashboardRoutes from './routes/dashboard.js';
import aiRoutes from './routes/ai.js';
import settingsRoutes from './routes/settings.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // the SPA is served separately in development
}));
app.use(compression());
app.use(cors({
  origin: isProd ? config.clientUrl : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(isProd ? 'combined' : 'dev'));

// A broad ceiling; individual routes apply their own tighter limits.
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
}));

// Uploaded files are served straight from disk.
if (!fs.existsSync(config.uploads.dir)) fs.mkdirSync(config.uploads.dir, { recursive: true });
app.use(config.uploads.publicPath, express.static(config.uploads.dir, {
  maxAge: isProd ? '30d' : 0,
  etag: true,
}));

app.get('/api/health', async (_req, res) => {
  let db = false;
  try { db = await testConnection(); } catch { db = false; }
  res.status(db ? 200 : 503).json({
    status: db ? 'ok' : 'degraded',
    database: db ? 'connected' : 'unreachable',
    uptime_seconds: Math.round(process.uptime()),
    environment: config.env,
  });
});

// ---------------------------------------------------------------- ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/print-orders', printRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api', resourceRoutes); // generic CRUD for the remaining tables

// In production the built SPA is served from the same origin.
// Resolved from this file, not from cwd: in production the process may be
// started from the repo root (npm start) or from server/, and both must find
// the built SPA.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (isProd && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use('/api/*', notFoundHandler);
app.use(errorHandler);

// ----------------------------------------------------------------- BOOT
async function start() {
  try {
    await testConnection();
    console.log(`[db] connected to ${config.db.database} at ${config.db.host}:${config.db.port}`);
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    console.error('     Check server/.env and make sure MySQL is running, then run: npm run db:setup');
    if (isProd) process.exit(1);
  }

  startFxScheduler();

  app.listen(config.port, () => {
    console.log('');
    console.log('  Creative Engine API');
    console.log(`  http://localhost:${config.port}`);
    console.log(`  environment: ${config.env}`);
    console.log('');
  });
}

start();

process.on('unhandledRejection', (err) => console.error('[unhandled rejection]', err));
process.on('uncaughtException', (err) => {
  console.error('[uncaught exception]', err);
  if (isProd) process.exit(1);
});

export default app;
