import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { db } from '../database/init';
import { HttpError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().max(100).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      throw new HttpError(error.details[0].message, 400);
    }

    const { email, password, name } = value;

    // Check if user already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingUser) {
      throw new HttpError('User already exists with this email', 409);
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userId = await new Promise<number>((resolve, reject) => {
      db.run(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
        [email, passwordHash, name || null],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET || jwtSecret + '_refresh';
    
    if (!jwtSecret) {
      throw new HttpError('JWT secret not configured', 500);
    }

    const accessToken = jwt.sign(
      { id: userId, email, type: 'access' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { id: userId, email, type: 'refresh' },
      refreshSecret,
      { expiresIn: '7d' }
    );

    // Store refresh token in database
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET refresh_token = ? WHERE id = ?',
        [refreshToken, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userId,
        email,
        name: name || null,
        credits: 5,
        isSubscribed: false,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      throw new HttpError(error.details[0].message, 400);
    }

    const { email, password } = value;

    // Find user
    const user = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id, email, password_hash, name, credits, is_subscribed FROM users WHERE email = ?',
        [email],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      throw new HttpError('Invalid email or password', 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new HttpError('Invalid email or password', 401);
    }

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET || jwtSecret + '_refresh';
    
    if (!jwtSecret) {
      throw new HttpError('JWT secret not configured', 500);
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, type: 'access' },
      jwtSecret,
      { expiresIn: '1h' } // 1시간으로 단축
    );

    const refreshToken = jwt.sign(
      { id: user.id, email: user.email, type: 'refresh' },
      refreshSecret,
      { expiresIn: '7d' }
    );

    // Store refresh token in database
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET refresh_token = ? WHERE id = ?',
        [refreshToken, user.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: user.credits,
        isSubscribed: Boolean(user.is_subscribed),
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new HttpError('Refresh token required', 401);
    }

    const jwtSecret = process.env.JWT_SECRET!;
    const refreshSecret = process.env.JWT_REFRESH_SECRET || jwtSecret + '_refresh';

    try {
      // Verify refresh token with refresh secret
      const decoded = jwt.verify(refreshToken, refreshSecret) as any;
      
      if (decoded.type !== 'refresh') {
        throw new HttpError('Invalid token type', 401);
      }

      // Check if refresh token exists in database and is valid
      const user = await new Promise<any>((resolve, reject) => {
        db.get(
          'SELECT id, email, name, credits, is_subscribed, refresh_token FROM users WHERE id = ? AND refresh_token = ?',
          [decoded.id, refreshToken],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user) {
        throw new HttpError('Invalid refresh token', 401);
      }

      // Generate new access token
      const newAccessToken = jwt.sign(
        { id: user.id, email: user.email, type: 'access' },
        jwtSecret,
        { expiresIn: '1h' }
      );

      // Generate new refresh token (token rotation for security)
      const newRefreshToken = jwt.sign(
        { id: user.id, email: user.email, type: 'refresh' },
        refreshSecret,
        { expiresIn: '7d' }
      );

      // Update refresh token in database
      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE users SET refresh_token = ? WHERE id = ?',
          [newRefreshToken, user.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.json({
        message: 'Token refreshed successfully',
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          credits: user.credits,
          isSubscribed: Boolean(user.is_subscribed),
        }
      });

    } catch (jwtError) {
      if (jwtError instanceof jwt.JsonWebTokenError) {
        throw new HttpError('Invalid refresh token', 401);
      }
      throw jwtError;
    }

  } catch (error) {
    next(error);
  }
});

// Logout (invalidate refresh token)
router.post('/logout', authenticateToken, async (req: any, res, next) => {
  try {
    const userId = req.user?.id;
    
    if (userId) {
      // Remove refresh token from database
      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE users SET refresh_token = NULL WHERE id = ?',
          [userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

export { router as authRoutes };