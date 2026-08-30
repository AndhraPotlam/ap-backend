import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import promClient from 'prom-client';
import { logger } from './utils/logger';
import { prisma, connectPrisma } from './config/prisma';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

// Import routes
import userRoutes from './routes/userRoutes';
import productRoutes from './routes/productRoutes';
import categoryRoutes from './routes/categoryRoutes';
import uploadRoutes from './routes/uploadRoutes';
import orderRoutes from './routes/orderRoutes';
import settingsRoutes from './routes/settingsRoutes';
import couponRoutes from './routes/couponRoutes';
import discountRoutes from './routes/discountRoutes';
import cartRoutes from './routes/cartRoutes';
import taskRoutes from './routes/taskRoutes';
import taskTemplateRoutes from './routes/taskTemplateRoutes';
import expenseRoutes from './routes/expenseRoutes';
import expenseCategoryRoutes from './routes/expenseCategoryRoutes';
import cashBoxRoutes from './routes/cashBoxRoutes';
import recipeProcessRoutes from './routes/recipeProcessRoutes';
import dayPlanRoutes from './routes/dayPlanRoutes';
import recipeRoutes from './routes/recipeRoutes';
import rawMaterialRoutes from './routes/rawMaterialRoutes';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const port = process.env.PORT || 8000;

// ---------- ✅ Universal CORS Middleware for Vercel (MUST come first) ----------
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Universal allowed origins for Andhra Potlam
  const allowedOrigins: (string | RegExp)[] = [
    // Local development
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    
    // Production and custom domains
    'https://app.andhrapotlam.in',
    'https://andhrapotlam.in',
    'https://api.andhrapotlam.in',
    'https://app.andhrapotlam.com',
    'https://andhrapotlam.com',
    'https://api.andhrapotlam.com',
    /^https:\/\/.*\.andhrapotlam\.in$/,
    /^https:\/\/.*\.andhrapotlam\.com$/,

    // Environment-provided frontend URL
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : []),
    
    // Vercel frontend domains (wildcard for all Vercel deployments)
    /^https:\/\/.*\.vercel\.app$/,
    
    // Netlify domains
    /^https:\/\/.*\.netlify\.app$/,
  ];

  // Check if origin is allowed
  const isAllowed = allowedOrigins.some(allowedOrigin => {
    if (typeof allowedOrigin === 'string') {
      return origin === allowedOrigin;
    } else if (allowedOrigin instanceof RegExp) {
      return allowedOrigin.test(origin || '');
    }
    return false;
  });

  if (origin && isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie'
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    );
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    return res.status(204).end();
  }

  next();
});

// ---------- Core Middleware ----------
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET || 'your-cookie-secret'));

// Request tracing and structured JSON logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = requestId.toString();
  res.setHeader('X-Request-Id', req.id);

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`HTTP ${req.method} ${req.url} - ${res.statusCode}`, {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs: duration,
      userAgent: req.headers['user-agent'],
    }, req.id);
  });

  next();
});

// ---------- Connect to PostgreSQL via Prisma ----------
connectPrisma().catch((err) => {
  logger.error('❌ Failed to initialize Prisma connection:', { error: err.message, stack: err.stack });
});

// ---------- API Routes ----------
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/task-templates', taskTemplateRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/expense-categories', expenseCategoryRoutes);
app.use('/api/cashbox', cashBoxRoutes);
app.use('/api/recipe-processes', recipeProcessRoutes);
app.use('/api/day-plans', dayPlanRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/raw-materials', rawMaterialRoutes);

// ---------- Health Check ----------
app.get('/api', (req, res) => {
  res.send('Hello, welcome to Andhra Portal API!');
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'READY', database: 'connected', engine: 'postgresql' });
  } catch (error: any) {
    logger.warn('Ready check failed: Database not connected', { error: error.message }, req.id);
    res.status(503).json({ status: 'NOT_READY', database: 'disconnected' });
  }
});

// ---------- Metrics ----------
promClient.collectDefaultMetrics();

app.get('/api/metrics', async (req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// ---------- Global Error Handler ----------
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error('Global Error Handler caught error', { error: err.message, stack: err.stack }, req.id);
    res.status(500).json({ message: 'Something went wrong!' });
  }
);

// ---------- Start Server ----------
app.listen(port, () => {
  logger.info(`🚀 Server running on port ${port}`);
  
  // Task management is now manual - no automatic scheduler
  logger.info('📅 Task management ready (manual generation)');
});

// Export handler for Vercel
export default app;
