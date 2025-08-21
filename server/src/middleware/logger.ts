import { Request, Response, NextFunction } from 'express';

export const logger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${req.ip}`);
  
  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusColor = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
    
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${statusColor}${status}\x1b[0m - ${duration}ms`
    );
  });

  next();
};