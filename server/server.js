const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 1. Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB, getDBStatus } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Resolve frontend root directory (containing index.html, css/, js/, sai-uni-img.jpg)
const candidatePath = path.resolve(__dirname, '..');
const frontendPath = fs.existsSync(path.join(candidatePath, 'index.html'))
  ? candidatePath
  : process.cwd();

// 2. Security Middleware (Helmet with Explicit, Tailored Content Security Policy)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "blob:"],
      connectSrc: [
        "'self'",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "https://insearch-backend.onrender.com",
        "https://*.onrender.com"
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));

// 3. CORS Configuration for local frontend development and production
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'http://localhost:3000',
      'http://localhost:5000',
      'https://insearch-backend.onrender.com'
    ];

if (process.env.RENDER_EXTERNAL_URL && !allowedOrigins.includes(process.env.RENDER_EXTERNAL_URL)) {
  allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman, same-origin)
    if (!origin) return callback(null, true);
    let hostname = '';
    try {
      hostname = new URL(origin).hostname;
    } catch (e) {
      hostname = '';
    }
    if (
      allowedOrigins.indexOf(origin) !== -1 ||
      process.env.NODE_ENV === 'development' ||
      hostname.endsWith('.onrender.com') ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    ) {
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

// 7. Security Guard: Block direct HTTP access to server source code, environment/config files,
// dependencies, version control, and temporary scratch tools BEFORE static serving.
const BLOCKED_PATH_PATTERNS = [
  /^\/server(\/.*)?$/i,
  /^\/scratch(\/.*)?$/i,
  /^\/node_modules(\/.*)?$/i,
  /^\/\.git(\/.*)?$/i,
  /\.(env|example|json|log|md|gitignore|lock|ya?ml|config)$/i,
  /package.*\.json$/i,
  /\.env.*/i
];

app.use((req, res, next) => {
  // Allow standard API requests through
  if (req.path.startsWith('/api')) {
    return next();
  }

  const normalizedPath = decodeURIComponent(req.path).trim();
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return res.status(404).json({
        error: 'Route Not Found',
        path: req.originalUrl
      });
    }
  }
  next();
});

// 8. Serve Frontend Static Assets (css, js, images, etc.) from repository root
app.use(express.static(frontendPath, {
  dotfiles: 'ignore',
  index: false
}));

// Root route: Serve frontend index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Client-side routing fallback: Serve index.html for non-API GET requests
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 9. 404 Handler for undefined API routes and non-GET requests
app.use((req, res) => {
  res.status(404).json({
    error: 'Route Not Found',
    path: req.originalUrl,
    method: req.method
  });
});

// 10. Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    environment: process.env.NODE_ENV || 'development'
  });
});

// 11. Connect to Database & Start HTTP Server
const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  // Listen on configured port
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 InSearch Server listening on http://localhost:${PORT}`);
    console.log(`📡 Health Check URL: http://localhost:${PORT}/api/health`);
    console.log(`🌐 Frontend Root: ${frontendPath}`);
    console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`====================================================`);
  });
};

startServer();

module.exports = app;
