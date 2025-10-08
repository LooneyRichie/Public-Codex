const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Redis = require('ioredis');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const poemRoutes = require('./routes/poemRoutes');
const userRoutes = require('./routes/userRoutes');
const searchRoutes = require('./routes/searchRoutes');

// Import services
const VectorService = require('./services/VectorService');
const LedgerService = require('./services/LedgerService');
const FileBasedLedger = require('./services/FileBasedLedger');
const EventBus = require('./services/EventBus');
const FileLedger = require('./services/FileLedger');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connections
let redis;
let vectorService;
let ledgerService;
let fileLedger;
let mongoMemory;

const initializeServices = async () => {
  try {
    // MongoDB connection: try env URI first; if missing or fails, fallback to in-memory
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri) {
      try {
        await mongoose.connect(mongoUri);
        console.log('📚 MongoDB connected successfully');
      } catch (e) {
        console.warn('⚠️ MongoDB connection failed, trying in-memory MongoDB. Error:', e?.message);
        try {
          mongoMemory = await MongoMemoryServer.create();
          const uri = mongoMemory.getUri();
          await mongoose.connect(uri);
          console.log('📚 MongoDB (in-memory) connected for development');
        } catch (memoryError) {
          console.warn('⚠️ In-memory MongoDB failed (likely disk space), using basic storage mode. Error:', memoryError?.message);
          // Skip MongoDB initialization - we'll use a simple in-memory store
          global.simpleStore = {
            users: new Map(),
            poems: new Map(),
            sessions: new Map()
          };
          console.log('📚 Simple in-memory store initialized (no disk required)');
        }
      }
    } else {
      try {
        mongoMemory = await MongoMemoryServer.create();
        const uri = mongoMemory.getUri();
        await mongoose.connect(uri);
        console.log('📚 MongoDB (in-memory) connected for development');
      } catch (memoryError) {
        console.warn('⚠️ In-memory MongoDB failed (likely disk space), using basic storage mode. Error:', memoryError?.message);
        // Skip MongoDB initialization - we'll use a simple in-memory store
        global.simpleStore = {
          users: new Map(),
          poems: new Map(),
          sessions: new Map()
        };
        console.log('📚 Simple in-memory store initialized (no disk required)');
      }
    }

    // Redis connection (optional)
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL);
      redis.on('connect', () => console.log('⚡ Redis connected successfully'));
      redis.on('error', (err) => console.error('Redis connection error:', err));
    } else {
      console.warn('⚠️ Redis URL not set. Continuing without Redis cache.');
    }

    // Initialize Vector Service (Pinecone)
    vectorService = new VectorService();
    await vectorService.initialize();
    console.log('🧠 Vector database initialized');

    // Initialize Ledger Service
    ledgerService = new LedgerService();
    console.log('🔒 Ledger service initialized');

    // Initialize File-based Ledger (unconventional path)
    fileLedger = new FileBasedLedger();
    await fileLedger.initialize();

    // Make services available globally
    app.locals.redis = redis;
    app.locals.vectorService = vectorService;
    app.locals.ledgerService = ledgerService;
    app.locals.fileLedger = fileLedger;

  } catch (error) {
    console.error('Service initialization error:', error);
    process.exit(1);
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/poems', poemRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoose.connection.readyState === 1,
      redis: redis?.status === 'ready',
      vector: vectorService?.isReady,
      ledger: ledgerService?.isReady,
      fileLedger: fileLedger?.isReady
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
const startServer = async () => {
  await initializeServices();
  
  app.listen(PORT, () => {
    console.log(`🚀 Poet's Codex server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  if (mongoMemory) await mongoMemory.stop();
  if (redis) redis.disconnect();
  process.exit(0);
});

startServer().catch(console.error);

module.exports = app;