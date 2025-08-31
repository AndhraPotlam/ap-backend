import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import morgan from 'morgan';

// Import routes
import userRoutes from './routes/userRoutes';
import productRoutes from './routes/productRoutes';
import categoryRoutes from './routes/categoryRoutes';
import uploadRoutes from './routes/uploadRoutes';
import orderRoutes from './routes/orderRoutes';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const port = process.env.PORT || 8000;

// ---------- ✅ Universal CORS Middleware for Vercel (MUST come first) ----------
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Universal allowed origins for Vercel deployments
  const allowedOrigins = [
    // Local development
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    
    // Vercel frontend domains (wildcard for all Vercel deployments)
    /^https:\/\/.*\.vercel\.app$/,
    /^https:\/\/.*\.vercel\.app\/.*$/,
    
    // Specific domains (if you want to be more restrictive)
    'https://ap-frontend-mu.vercel.app',
    'https://ap-frontend-git-main-andhra-potlams-projects.vercel.app',
    'https://andhra-potlam.vercel.app',
    
    // Netlify domains (if you use Netlify)
    /^https:\/\/.*\.netlify\.app$/,
    
    // Custom domains (add your custom domain here)
    // 'https://yourdomain.com'
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
app.use(morgan('dev'));

// Optional: Log requests
app.use((req, res, next) => {
  console.log('--------------------');
  console.log('Request URL:', req.url);
  console.log('Request Method:', req.method);
  console.log('Request Body:', req.body);
  console.log('--------------------');
  next();
});

// ---------- Connect to MongoDB ----------
const connectDB = async () => {
  try {
    const mongoUrl = process.env.MONGODB_URI;
    if (!mongoUrl) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }
    await mongoose.connect(mongoUrl, {
      ssl: true,
      tls: true,
      tlsAllowInvalidCertificates: false
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};
connectDB();

// ---------- API Routes ----------
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);

// ---------- Health Check ----------
app.get('/api', (req, res) => {
  res.send('Hello, welcome to Andhra Portal API!');
});

// ---------- Global Error Handler ----------
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
  }
);

// ---------- Start Server ----------
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

// Export handler for Vercel
export default app;
