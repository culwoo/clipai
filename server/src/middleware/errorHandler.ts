import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  details?: any;
}

export class HttpError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends HttpError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends HttpError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends HttpError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends HttpError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

// Error logger
const logError = (error: AppError, req: Request) => {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level: 'ERROR',
    message: error.message,
    statusCode: error.statusCode,
    code: error.code,
    stack: error.stack,
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    },
    details: error.details,
  };

  // Console log for development
  console.error(`[${timestamp}] Error ${error.statusCode || 500}:`, {
    message: error.message,
    code: error.code,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // File logging for production
  if (process.env.NODE_ENV === 'production') {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);
    const logLine = JSON.stringify(logData) + '\n';

    fs.appendFileSync(logFile, logLine);
  }
};

// Handle specific error types
const handleDatabaseError = (error: any): AppError => {
  if (error.code === 'SQLITE_CONSTRAINT') {
    if (error.message.includes('UNIQUE constraint failed')) {
      return new ConflictError('Resource already exists');
    }
    if (error.message.includes('NOT NULL constraint failed')) {
      return new ValidationError('Required field is missing');
    }
    return new ValidationError('Database constraint violation');
  }
  
  if (error.code === 'ENOENT') {
    return new NotFoundError('File');
  }
  
  return new HttpError(error.message || 'Database error', 500, 'DATABASE_ERROR');
};

const handleJWTError = (error: any): AppError => {
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired');
  }
  return new AuthenticationError('Authentication error');
};

const handleMulterError = (error: any): AppError => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new ValidationError('File too large', { maxSize: '50MB' });
  }
  if (error.code === 'LIMIT_FILE_COUNT') {
    return new ValidationError('Too many files');
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new ValidationError('Unexpected file field');
  }
  return new ValidationError('File upload error');
};

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let appError: AppError;

  // Handle known error types
  if (error instanceof HttpError) {
    appError = error;
  } else if (error.code?.startsWith('SQLITE_')) {
    appError = handleDatabaseError(error);
  } else if (error.name?.includes('JsonWebToken') || error.name?.includes('TokenExpired')) {
    appError = handleJWTError(error);
  } else if (error.code?.startsWith('LIMIT_')) {
    appError = handleMulterError(error);
  } else if (error.name === 'ValidationError') {
    appError = new ValidationError(error.message, error.details);
  } else if (error.name === 'CastError') {
    appError = new ValidationError('Invalid data format');
  } else if (error.code === 'ECONNREFUSED') {
    appError = new HttpError('Service unavailable', 503, 'SERVICE_UNAVAILABLE');
  } else if (error.code === 'ETIMEOUT') {
    appError = new HttpError('Request timeout', 408, 'REQUEST_TIMEOUT');
  } else {
    // Unknown error
    appError = new HttpError(
      process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message,
      500,
      'INTERNAL_ERROR'
    );
  }

  // Log the error
  logError(appError, req);

  // Send response
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(appError.statusCode || 500).json({
    error: {
      message: appError.message,
      code: appError.code,
      status: appError.statusCode,
      ...(appError.details && { details: appError.details }),
      ...(isProduction ? {} : { 
        stack: appError.stack,
        originalError: error.message 
      }),
    },
  });
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global uncaught exception handler
export const setupGlobalErrorHandlers = () => {
  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
};