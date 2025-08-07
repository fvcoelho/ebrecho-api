import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { prisma } from './prisma';
import authRoutes from './routes/auth.routes';
import partnerRoutes from './routes/partner.routes';
import addressRoutes from './routes/address.routes';
import productRoutes from './routes/product.routes';
import imageRoutes from './routes/image.routes';
import databaseRoutes from './routes/database.routes';
import adminRoutes from './routes/admin.routes';
import dashboardRoutes from './routes/dashboard.routes';
import onboardingRoutes from './routes/onboarding.routes';
import promoterRoutes from './routes/promoter.routes';
import { aiEnhancementRoutes } from './routes/ai-enhancement.routes';
import { tryonRoutes } from './routes/tryon.routes';
import testUploadRoutes from './routes/test-upload.routes';
import publicRoutes from './routes/public';
import userRoutes from './routes/user.routes';
import orderRoutes from './routes/order.routes';
import customerRoutes from './routes/customer.routes';
import { errorHandler } from './middlewares/error.middleware';

// Load environment variables
dotenv.config();

// Initialize Express app
export const app = express();

// Middlewares
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080',
      process.env.FRONTEND_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      'http://165.227.65.227',
      'http://165.227.65.227:8080',
      'http://165.227.65.227:80',
      'http://ebrecho.com.br',
      'http://www.ebrecho.com.br',
      'https://ebrecho.com.br',
      'https://www.ebrecho.com.br',
      'https://dev.ebrecho.com.br',
      'http://dev.ebrecho.com.br'
    ].filter(Boolean); // Remove undefined values
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.error('CORS blocked origin:', origin);
      console.error('Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploaded images)
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Health check route
app.get('/health', async (req, res) => {
  console.log('Health check called');
  
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'connected'
      }
    });
  } catch (error) {
    console.error('Database connection failed in health check:', error);
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'disconnected'
      }
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/products', productRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/promoter', promoterRoutes);
app.use('/api/ai-enhancement', aiEnhancementRoutes);
app.use('/api/tryon', tryonRoutes);
app.use('/api/test-upload', testUploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);

// Public API Routes (no auth required)
app.use('/api/public', publicRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Handle shutdown gracefully for serverless
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Initialize database connection for serverless
export const initDatabase = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }
};