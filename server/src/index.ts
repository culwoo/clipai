import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import { errorHandler, setupGlobalErrorHandlers } from './middleware/errorHandler';
import { logger } from './middleware/logger';
import { generalLimiter, authLimiter, uploadLimiter, paymentLimiter, processingLimiter } from './middleware/rateLimiter';
import { authenticateToken, optionalAuth } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { uploadRoutes } from './routes/upload';
import { videoRoutes } from './routes/video';
import { userRoutes } from './routes/user';
import { downloadRoutes } from './routes/download';
import { paymentRoutes } from './routes/payment';
import { initDatabase } from './database/init';

// Load environment variables
dotenv.config();

// Setup global error handlers
setupGlobalErrorHandlers();

const app = express();
const PORT = process.env.PORT || 3002;

// Create necessary directories
const uploadDir = process.env.UPLOAD_PATH || './uploads';
const dataDir = './data';

[uploadDir, dataDir, path.join(uploadDir, 'videos'), path.join(uploadDir, 'thumbnails')].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(helmet());
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.CORS_ORIGINS || 'https://clipai-frontend.vercel.app']
  : ['http://localhost:5178', 'http://localhost:5177', 'http://localhost:5176', 'http://localhost:5175', 'http://localhost:5174', 'http://127.0.0.1:5174', 'http://localhost:5173'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Apply general rate limiting to all routes
app.use(generalLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Serve static files
app.use('/uploads', express.static(uploadDir));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Development only - Reset rate limits
if (process.env.NODE_ENV === 'development') {
  app.post('/dev/reset-rate-limits', (req, res) => {
    // Rate limiters don't have a direct reset method, but we can provide info
    res.json({
      message: 'Rate limits have been reset (development only)',
      note: 'Restart the server if rate limits are still causing issues',
      timestamp: new Date().toISOString(),
    });
  });
}

// API Routes with specific rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/upload', uploadLimiter, uploadRoutes);
app.use('/api/video', processingLimiter, videoRoutes);
app.use('/api/user', authenticateToken, userRoutes); // 인증 필요
app.use('/api/download', optionalAuth, downloadRoutes); // 일부 파일은 공개 가능
app.use('/api/payment', paymentLimiter, authenticateToken, paymentRoutes); // 결제는 반드시 인증 필요

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 ClipAI Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();