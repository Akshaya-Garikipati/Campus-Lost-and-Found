const path = require('path');
const dotenv = require('dotenv');

// 1. Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB, getDBStatus } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// 2. Security Middleware (Helmet)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 3. CORS Configuration for local frontend development
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000', 'http://localhost:5000'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Access denied for this origin.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 4. Request Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Health Check Endpoint (GET /api/health)
app.get('/api/health', (req, res) => {
  const dbStatus = getDBStatus();
  const isDBConnected = dbStatus.status === 'connected';

  res.status(isDBConnected ? 200 : 503).json({
    status: isDBConnected ? 'ok' : 'degraded',
    message: isDBConnected
      ? 'InSearch Backend API is operational and connected to MongoDB'
      : 'InSearch Backend API is running, but MongoDB is disconnected or unreachable',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus
  });
});

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to InSearch API — Sai University Lost & Found Portal',
    healthCheck: '/api/health',
    version: '1.0.0'
  });
});

// 6. API Route Handlers
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const claimRoutes = require('./routes/claimRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

// 7. 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Route Not Found',
    path: req.originalUrl,
    method: req.method
  });
});

// 8. Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    environment: process.env.NODE_ENV || 'development'
  });
});

// 8. Connect to Database & Start HTTP Server
const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  // Listen on configured port
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 InSearch Server listening on http://localhost:${PORT}`);
    console.log(`📡 Health Check URL: http://localhost:${PORT}/api/health`);
    console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`====================================================`);
  });
};

startServer();

module.exports = app;
