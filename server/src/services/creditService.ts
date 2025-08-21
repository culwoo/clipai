import { db } from '../database/init';
import { HttpError } from '../middleware/errorHandler';

export interface User {
  id: number;
  credits: number;
  isSubscribed: boolean;
  subscriptionExpiresAt?: string;
}

export interface CreditCheckResult {
  canProceed: boolean;
  user?: User;
  reason?: string;
}

export class CreditService {
  
  /**
   * Check if user can proceed with an operation that costs credits
   */
  static async checkCredits(userId?: number): Promise<CreditCheckResult> {
    // Non-authenticated users cannot proceed (this should be handled at auth level)
    if (!userId) {
      return {
        canProceed: false,
        reason: 'Authentication required'
      };
    }

    // Get user info including subscription status
    const user = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT id, credits, is_subscribed, subscription_expires_at 
         FROM users WHERE id = ?`, 
        [userId], 
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      return {
        canProceed: false,
        reason: 'User not found'
      };
    }

    const userData: User = {
      id: user.id,
      credits: user.credits,
      isSubscribed: user.is_subscribed === 1,
      subscriptionExpiresAt: user.subscription_expires_at
    };

    // Check if subscription is active and not expired
    if (userData.isSubscribed && userData.subscriptionExpiresAt) {
      const expirationDate = new Date(userData.subscriptionExpiresAt);
      const now = new Date();
      
      if (expirationDate > now) {
        // Active subscription - no credit check needed
        return {
          canProceed: true,
          user: userData
        };
      } else {
        // Expired subscription - update user status
        await this.updateSubscriptionStatus(userId, false);
        userData.isSubscribed = false;
        userData.subscriptionExpiresAt = undefined;
      }
    }

    // For non-subscribers, check credits
    if (!userData.isSubscribed && userData.credits <= 0) {
      return {
        canProceed: false,
        user: userData,
        reason: 'Insufficient credits'
      };
    }

    return {
      canProceed: true,
      user: userData
    };
  }

  /**
   * Deduct credits from user (only if not subscribed)
   * Optimized version that accepts pre-checked user data
   */
  static async deductCredits(userId: number, userInfo?: User): Promise<void> {
    let user = userInfo;
    
    // Only check credits if user info not provided
    if (!user) {
      const creditCheck = await this.checkCredits(userId);
      
      if (!creditCheck.canProceed) {
        throw new HttpError(creditCheck.reason || 'Cannot deduct credits', 402);
      }
      
      user = creditCheck.user;
    }

    // Don't deduct credits for active subscribers
    if (user?.isSubscribed) {
      console.log(`User ${userId} is subscribed - no credit deduction`);
      return;
    }

    // Deduct credit for non-subscribers
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0',
        [userId],
        function(err) {
          if (err) {
            reject(err);
          } else if (this.changes === 0) {
            // No rows affected - either user doesn't exist or no credits left
            reject(new Error('Failed to deduct credit - insufficient credits'));
          } else {
            console.log(`Credit deducted for user ${userId}`);
            resolve();
          }
        }
      );
    });
  }

  /**
   * Add credits to user account
   */
  static async addCredits(userId: number, amount: number): Promise<void> {
    if (amount <= 0) {
      throw new Error('Credit amount must be positive');
    }

    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET credits = credits + ? WHERE id = ?',
        [amount, userId],
        function(err) {
          if (err) {
            reject(err);
          } else if (this.changes === 0) {
            reject(new Error('User not found'));
          } else {
            console.log(`Added ${amount} credits to user ${userId}`);
            resolve();
          }
        }
      );
    });
  }

  /**
   * Update user subscription status
   */
  static async updateSubscriptionStatus(userId: number, isSubscribed: boolean, expiresAt?: Date): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET is_subscribed = ?, subscription_expires_at = ? WHERE id = ?',
        [isSubscribed ? 1 : 0, expiresAt?.toISOString() || null, userId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            console.log(`Updated subscription status for user ${userId}: ${isSubscribed}`);
            resolve();
          }
        }
      );
    });
  }

  /**
   * Get user credit info
   */
  static async getUserCredits(userId: number): Promise<User | null> {
    const creditCheck = await this.checkCredits(userId);
    return creditCheck.user || null;
  }

  /**
   * Check credits for non-authenticated users (guest limit)
   */
  static checkGuestCredits(remainingCredits: number): boolean {
    return remainingCredits > 0;
  }

  /**
   * Refund credits if processing fails (only for non-subscribers)
   */
  static async refundCredits(userId: number): Promise<void> {
    try {
      const user = await this.getUserCredits(userId);
      
      if (!user) {
        console.warn(`Cannot refund credits - user ${userId} not found`);
        return;
      }

      // Don't refund credits for active subscribers
      if (user.isSubscribed) {
        console.log(`User ${userId} is subscribed - no credit refund needed`);
        return;
      }

      // Refund credit
      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE users SET credits = credits + 1 WHERE id = ?',
          [userId],
          function(err) {
            if (err) {
              reject(err);
            } else {
              console.log(`Credit refunded to user ${userId}`);
              resolve();
            }
          }
        );
      });
    } catch (error) {
      console.error(`Failed to refund credits for user ${userId}:`, error);
      // Don't throw - refund failure shouldn't fail the entire operation
    }
  }

  /**
   * Execute credit operation with rollback capability
   */
  static async executeWithRollback<T>(
    userId: number, 
    operation: () => Promise<T>
  ): Promise<T> {
    let creditDeducted = false;
    
    try {
      // Check and deduct credits first
      await this.deductCredits(userId);
      creditDeducted = true;
      
      // Execute the operation
      const result = await operation();
      
      return result;
    } catch (error) {
      // Rollback credit deduction if operation failed
      if (creditDeducted) {
        console.log(`Operation failed, rolling back credit deduction for user ${userId}`);
        await this.refundCredits(userId);
      }
      throw error;
    }
  }
}