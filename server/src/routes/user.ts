import express from 'express';
import { db } from '../database/init';
import { HttpError } from '../middleware/errorHandler';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const user = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id, email, name, credits, is_subscribed, subscription_expires_at, created_at FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      throw new HttpError('User not found', 404);
    }

    // Get processing history count
    const processingCount = await new Promise<number>((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM processing_results WHERE user_id = ?', [userId], (err, row: any) => {
        if (err) reject(err);
        else resolve(row?.count || 0);
      });
    });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      credits: user.credits,
      isSubscribed: Boolean(user.is_subscribed),
      subscriptionExpiresAt: user.subscription_expires_at,
      processingCount,
      memberSince: user.created_at,
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { name } = req.body;

    if (name !== undefined && (typeof name !== 'string' || name.length > 100)) {
      throw new HttpError('Invalid name format', 400);
    }

    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name || null, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Get processing history
router.get('/history', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const history = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT pr.*, v.original_filename, v.file_size, v.mime_type,
                COUNT(hc.id) as highlight_count,
                COUNT(t.id) as thumbnail_count,
                COUNT(c.id) as caption_count
         FROM processing_results pr
         JOIN videos v ON pr.video_id = v.id
         LEFT JOIN highlight_clips hc ON pr.id = hc.processing_result_id
         LEFT JOIN thumbnails t ON pr.id = t.processing_result_id
         LEFT JOIN captions c ON pr.id = c.processing_result_id
         WHERE pr.user_id = ?
         GROUP BY pr.id
         ORDER BY pr.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const totalCount = await new Promise<number>((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM processing_results WHERE user_id = ?', [userId], (err, row: any) => {
        if (err) reject(err);
        else resolve(row?.count || 0);
      });
    });

    res.json({
      history: history.map(item => ({
        id: item.id,
        videoId: item.video_id,
        status: item.status,
        progress: item.progress,
        errorMessage: item.error_message,
        video: {
          originalName: item.original_filename,
          size: item.file_size,
          type: item.mime_type,
        },
        stats: {
          highlights: item.highlight_count,
          thumbnails: item.thumbnail_count,
          captions: item.caption_count,
        },
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Purchase credits (mock implementation)
router.post('/purchase-credits', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { amount, paymentMethod } = req.body;

    if (!amount || !Number.isInteger(amount) || amount <= 0) {
      throw new HttpError('Invalid credit amount', 400);
    }

    if (amount > 100) {
      throw new HttpError('Maximum 100 credits per purchase', 400);
    }

    // Mock payment processing
    // In a real app, you would integrate with Stripe, PayPal, etc.
    console.log(`Mock payment: User ${userId} purchasing ${amount} credits with ${paymentMethod}`);

    // Add credits to user account
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET credits = credits + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [amount, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Get updated user info
    const user = await new Promise<any>((resolve, reject) => {
      db.get('SELECT credits FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({
      message: 'Credits purchased successfully',
      creditsAdded: amount,
      totalCredits: user.credits,
    });
  } catch (error) {
    next(error);
  }
});

// Get subscription info
router.get('/subscription', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const user = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT is_subscribed, subscription_expires_at FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      throw new HttpError('User not found', 404);
    }

    res.json({
      isSubscribed: Boolean(user.is_subscribed),
      expiresAt: user.subscription_expires_at,
      plan: user.is_subscribed ? 'premium' : 'free',
    });
  } catch (error) {
    next(error);
  }
});

// Subscribe to premium (mock implementation)
router.post('/subscribe', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { plan, paymentMethod } = req.body;

    if (plan !== 'premium') {
      throw new HttpError('Invalid subscription plan', 400);
    }

    // Mock subscription processing
    console.log(`Mock subscription: User ${userId} subscribing to ${plan} with ${paymentMethod}`);

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month subscription

    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET is_subscribed = 1, subscription_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [expiresAt.toISOString(), userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      message: 'Subscription activated successfully',
      plan: 'premium',
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Delete processing result
router.delete('/processing-result/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const resultId = parseInt(req.params.id);

    if (isNaN(resultId)) {
      throw new HttpError('Invalid processing result ID', 400);
    }

    // First check if the processing result exists and belongs to the user
    const processingResult = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id, user_id FROM processing_results WHERE id = ?',
        [resultId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!processingResult) {
      throw new HttpError('Processing result not found', 404);
    }

    if (processingResult.user_id !== userId) {
      throw new HttpError('Access denied', 403);
    }

    // Delete related data in order (due to foreign key constraints)
    // Delete captions
    await new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM captions WHERE processing_result_id = ?', [resultId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Delete thumbnails
    await new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM thumbnails WHERE processing_result_id = ?', [resultId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Delete highlight clips
    await new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM highlight_clips WHERE processing_result_id = ?', [resultId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Finally delete the processing result
    await new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM processing_results WHERE id = ?', [resultId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'Processing result deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export { router as userRoutes };