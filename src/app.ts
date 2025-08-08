import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { prisma } from './prisma';
import { swaggerSpec } from './config/swagger.config';
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
import systemRoutes from './routes/system.routes';
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
      'http://localhost:3001', // Allow Swagger UI
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
      'http://dev.ebrecho.com.br',
      'https://api.ebrecho.com.br' // Allow production Swagger UI
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

// Swagger documentation - manual HTML with multiple CDN fallbacks
app.get('/api-docs', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>eBrecho API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4.15.5/swagger-ui.css" />
  <style>
    body { margin: 0; font-family: sans-serif; }
    .swagger-ui .topbar { display: none; }
    #loading { text-align: center; padding: 50px; font-size: 18px; color: #666; }
  </style>
</head>
<body>
  <div id="loading">Loading API Documentation...</div>
  <div id="swagger-ui"></div>
  <script>
    let retryCount = 0;
    const maxRetries = 20;
    
    // Function to initialize Swagger UI
    function initSwagger() {
      if (typeof SwaggerUIBundle !== 'undefined') {
        document.getElementById('loading').style.display = 'none';
        SwaggerUIBundle({
          url: '/api-docs.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIBundle.presets.standalone
          ],
          plugins: [
            SwaggerUIBundle.plugins.DownloadUrl
          ],
          layout: "BaseLayout"
        });
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(initSwagger, 200);
      } else {
        document.getElementById('loading').innerHTML = 'Error loading Swagger UI. Please refresh the page.';
      }
    }
    
    // Load Swagger UI bundle script with fallback
    function loadSwaggerScript() {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@4.15.5/swagger-ui-bundle.js';
      script.onload = function() {
        setTimeout(initSwagger, 100);
      };
      script.onerror = function() {
        // Fallback to unpkg CDN
        const fallbackScript = document.createElement('script');
        fallbackScript.src = 'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js';
        fallbackScript.onload = function() {
          setTimeout(initSwagger, 100);
        };
        fallbackScript.onerror = function() {
          document.getElementById('loading').innerHTML = 'Error loading Swagger UI from CDN. Please refresh the page.';
        };
        document.head.appendChild(fallbackScript);
      };
      document.head.appendChild(script);
    }
    
    // Start loading when page is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadSwaggerScript);
    } else {
      loadSwaggerScript();
    }
  </script>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/api-docs/', (req, res) => {
  res.redirect('/api-docs');
});

// Handle favicon requests to avoid 500 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).send(); // No content
});

// Serve Swagger JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Welcome screen - API root endpoint
app.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>eBrecho API</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 600px;
      width: 100%;
    }
    h1 {
      color: #333;
      font-size: 2.5rem;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    .subtitle {
      color: #666;
      font-size: 1.1rem;
      margin-bottom: 30px;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #10b981;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.9rem;
      margin-bottom: 30px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: white;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .links {
      display: flex;
      flex-direction: column;
      gap: 15px;
      margin-bottom: 30px;
    }
    .link-group {
      border-left: 3px solid #667eea;
      padding-left: 15px;
    }
    .link-title {
      font-size: 0.8rem;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    a {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: #667eea;
      text-decoration: none;
      font-size: 1.1rem;
      transition: all 0.3s ease;
      padding: 8px 0;
    }
    a:hover {
      color: #764ba2;
      transform: translateX(5px);
    }
    .arrow {
      font-size: 0.9rem;
    }
    .info {
      background: #f3f4f6;
      border-radius: 12px;
      padding: 20px;
      margin-top: 20px;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-item:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #666;
      font-size: 0.9rem;
    }
    .info-value {
      color: #333;
      font-weight: 500;
      font-size: 0.9rem;
    }
    .footer {
      text-align: center;
      color: #999;
      font-size: 0.8rem;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .footer a {
      color: #667eea;
      font-size: 0.8rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      <div class="logo">👗</div>
      eBrecho API
    </h1>
    <p class="subtitle">Second-hand Fashion Marketplace Platform</p>
    
    <div class="status">
      <span class="status-dot"></span>
      API Online
    </div>

    <div class="links">
      <div class="link-group">
        <div class="link-title">Documentation</div>
        <a href="/api-docs">
          <span>📚</span> Swagger Documentation
          <span class="arrow">→</span>
        </a>
        <a href="/api-docs.json">
          <span>📄</span> OpenAPI Specification
          <span class="arrow">→</span>
        </a>
      </div>

      <div class="link-group">
        <div class="link-title">Quick Links</div>
        <a href="/health">
          <span>❤️</span> Health Check
          <span class="arrow">→</span>
        </a>
        <a href="https://ebrecho.com.br" target="_blank">
          <span>🌐</span> Main Website
          <span class="arrow">→</span>
        </a>
      </div>

      <div class="link-group">
        <div class="link-title">Resources</div>
        <a href="https://github.com/fvcoelho/ebrecho-api" target="_blank">
          <span>💻</span> GitHub Repository
          <span class="arrow">→</span>
        </a>
        <a href="mailto:support@ebrecho.com.br">
          <span>📧</span> Contact Support
          <span class="arrow">→</span>
        </a>
      </div>
    </div>

    <div class="info">
      <div class="info-item">
        <span class="info-label">Version</span>
        <span class="info-value">1.0.1</span>
      </div>
      <div class="info-item">
        <span class="info-label">Environment</span>
        <span class="info-value">${process.env.NODE_ENV || 'development'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Base URL</span>
        <span class="info-value">${baseUrl}</span>
      </div>
      <div class="info-item">
        <span class="info-label">API Endpoints</span>
        <span class="info-value">23 documented</span>
      </div>
    </div>

    <div class="footer">
      <p>© 2024 eBrecho. All rights reserved.</p>
      <p style="margin-top: 10px;">
        Built by <a href="pegue.la">pegue.app</a> with ❤️ using Node.js, Express & Prisma
      </p>
    </div>
  </div>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

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

// System API Routes (admin auth required)
app.use('/api/system', systemRoutes);

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