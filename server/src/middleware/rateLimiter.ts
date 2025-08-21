import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { RateLimitError } from './errorHandler';

// Redis client setup
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Connect to Redis with error handling
redisClient.connect().catch((err) => {
  console.warn('Redis connection failed, falling back to memory store:', err.message);
});

redisClient.on('error', (err) => {
  console.warn('Redis client error:', err.message);
});

// Rate limit store - use Redis if available, otherwise memory
const createStore = () => {
  if (redisClient.isReady) {
    return new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    });
  }
  console.warn('Redis not available, using memory store for rate limiting');
  return undefined; // Use default memory store
};

// General API rate limiter
export const generalLimiter = rateLimit({
  store: createStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Higher limit for development
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    throw new RateLimitError('Too many requests, please slow down');
  },
});

// Strict rate limiter for auth endpoints
export const authLimiter = rateLimit({
  store: createStore(),
  windowMs: process.env.NODE_ENV === 'development' ? 60 * 1000 : 15 * 60 * 1000, // 1 minute in dev, 15 minutes in prod
  max: process.env.NODE_ENV === 'development' ? 1000 : 5, // Much higher limit for development
  message: {
    error: {
      message: 'Too many authentication attempts, please try again later',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      status: 429,
    }
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    throw new RateLimitError('Too many login attempts, please try again later');
  },
});

// Upload rate limiter
export const uploadLimiter = rateLimit({
  store: createStore(),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: {
    error: {
      message: 'Upload limit exceeded, please try again later',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      status: 429,
    }
  },
  handler: (req, res) => {
    throw new RateLimitError('Too many uploads, please try again later');
  },
});

// Payment rate limiter
export const paymentLimiter = rateLimit({
  store: createStore(),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 payment requests per hour
  message: {
    error: {
      message: 'Payment request limit exceeded, please try again later',
      code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
      status: 429,
    }
  },
  handler: (req, res) => {
    throw new RateLimitError('Too many payment requests, please try again later');
  },
});

// Video processing rate limiter
export const processingLimiter = rateLimit({
  store: createStore(),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // limit each IP to 50 processing requests per hour
  message: {
    error: {
      message: 'Processing limit exceeded, please try again later',
      code: 'PROCESSING_RATE_LIMIT_EXCEEDED',
      status: 429,
    }
  },
  handler: (req, res) => {
    throw new RateLimitError('Too many processing requests, please try again later');
  },
});

// Create custom rate limiter for specific needs
export const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    store: createStore(),
    windowMs,
    max,
    message: {
      error: {
        message,
        code: 'CUSTOM_RATE_LIMIT_EXCEEDED',
        status: 429,
      }
    },
    handler: (req, res) => {
      throw new RateLimitError(message);
    },
  });
};