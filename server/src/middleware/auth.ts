import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { HttpError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    throw new HttpError('Access token required', 401);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new HttpError('JWT secret not configured', 500);
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Ensure this is an access token, not a refresh token
    if (decoded.type !== 'access') {
      throw new HttpError('Invalid token type. Access token required.', 401);
    }
    
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new HttpError('Token expired', 401, 'TOKEN_EXPIRED');
    } else if (error instanceof HttpError) {
      throw error;
    } else {
      throw new HttpError('Invalid token', 403);
    }
  }
};

export const optionalAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Only accept access tokens
    if (decoded.type === 'access') {
      req.user = { id: decoded.id, email: decoded.email };
    }
  } catch (error) {
    // Invalid token, but we continue without user info
  }

  next();
};