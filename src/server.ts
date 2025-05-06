import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
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
const port = process.env.PORT;

// Connect to MongoDB
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
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Connect to database
connectDB();

// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests
app.options('*', cors());

// Parse JSON bodies
app.use(express.json());

// Parse cookies with secure settings
app.use(cookieParser(process.env.COOKIE_SECRET || 'your-cookie-secret'));

// Add logging middleware before routes
app.use(morgan('dev')); // Logs HTTP requests

// Add detailed request logging
app.use((req, res, next) => {
  console.log('--------------------');
  console.log('Request URL:', req.url);
  console.log('Request Method:', req.method);
  console.log('Request Body:', req.body);
  console.log('Request Headers:', req.headers);
  console.log('--------------------');
  next();
});


// Routes
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.get('/api', (req, res) => {
  res.send('Hello, welcome to andhra potal api!');
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;