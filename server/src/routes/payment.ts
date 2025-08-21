import express from 'express';
import Stripe from 'stripe';
import { db } from '../database/init';
import { HttpError } from '../middleware/errorHandler';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { paymentService } from '../services/paymentService';

const router = express.Router();

// Get credit packages
router.get('/packages', (req, res) => {
  const packages = paymentService.getCreditPackages();
  res.json({ packages });
});

// Get subscription plans
router.get('/plans', (req, res) => {
  const plans = paymentService.getSubscriptionPlans();
  res.json({ plans });
});

// Create payment intent for credit purchase
router.post('/create-payment-intent', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { packageId } = req.body;
    
    if (!packageId) {
      throw new HttpError('Package ID is required', 400);
    }

    const packages = paymentService.getCreditPackages();
    const selectedPackage = packages.find(p => p.priceId === packageId);
    
    if (!selectedPackage) {
      throw new HttpError('Invalid package', 400);
    }

    // Create payment intent
    const paymentIntent = await paymentService.createPaymentIntent(
      selectedPackage.price,
      'krw',
      {
        userId: req.user!.id,
        credits: selectedPackage.credits,
        packageId,
      }
    );

    // Store payment record
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO payments (user_id, amount, currency, credits, status, stripe_payment_intent_id, package_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user!.id,
          selectedPackage.price,
          'krw',
          selectedPackage.credits,
          'pending',
          paymentIntent.paymentIntentId,
          packageId,
        ],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      clientSecret: paymentIntent.clientSecret,
      amount: selectedPackage.price,
      credits: selectedPackage.credits,
    });
  } catch (error) {
    next(error);
  }
});

// Create subscription
router.post('/create-subscription', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { planId } = req.body;
    
    if (!planId) {
      throw new HttpError('Plan ID is required', 400);
    }

    const plans = paymentService.getSubscriptionPlans();
    const selectedPlan = plans.find(p => p.id === planId);
    
    if (!selectedPlan) {
      throw new HttpError('Invalid plan', 400);
    }

    // Get or create Stripe customer
    let stripeCustomerId: string;
    
    const existingCustomer = await new Promise<any>((resolve, reject) => {
      db.get('SELECT stripe_customer_id FROM users WHERE id = ?', [req.user!.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingCustomer?.stripe_customer_id) {
      stripeCustomerId = existingCustomer.stripe_customer_id;
    } else {
      // Create new Stripe customer  
      stripeCustomerId = await paymentService.createCustomer(
        req.user!.email,
        (req.user as any).name || req.user!.email
      );
      
      // Update user record
      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
          [stripeCustomerId, req.user!.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Create subscription
    const subscription = await paymentService.createSubscription(
      stripeCustomerId,
      selectedPlan.priceId
    );

    // Store subscription record
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO subscriptions (user_id, plan_id, status, stripe_subscription_id, monthly_credits) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.user!.id,
          planId,
          'pending',
          subscription.subscriptionId,
          selectedPlan.credits,
        ],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      clientSecret: subscription.clientSecret,
      subscriptionId: subscription.subscriptionId,
      plan: selectedPlan,
    });
  } catch (error) {
    next(error);
  }
});

// Create mock subscription for development testing
router.post('/create-mock-subscription', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      throw new HttpError('Mock subscriptions not allowed in production', 403);
    }

    // Check if user already has an active subscription
    const existingSubscription = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT * FROM subscriptions WHERE user_id = ? AND status = ?',
        [req.user!.id, 'active'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingSubscription) {
      throw new HttpError('User already has an active subscription', 400);
    }

    // Create mock subscription
    const mockSubscriptionId = await new Promise<number>((resolve, reject) => {
      db.run(
        `INSERT INTO subscriptions (user_id, plan_id, status, stripe_subscription_id, monthly_credits) 
         VALUES (?, ?, ?, ?, ?)`,
        [req.user!.id, 'premium', 'active', `sub_mock_dev_${Date.now()}`, 100],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    res.json({ 
      message: 'Mock subscription created successfully',
      subscriptionId: mockSubscriptionId,
      note: 'This is a development-only feature'
    });
  } catch (error) {
    next(error);
  }
});

// Cancel subscription
router.post('/cancel-subscription', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    // First check if Stripe is properly configured
    const isStripeConfigured = process.env.STRIPE_SECRET_KEY && 
                              process.env.STRIPE_SECRET_KEY !== 'your-stripe-secret-key-here';
    
    // Get all user's subscriptions for debugging
    const allSubscriptions = await new Promise<any[]>((resolve, reject) => {
      db.all(
        'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC',
        [req.user!.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    console.log(`User ${req.user!.id} subscriptions:`, allSubscriptions);
    
    // Get user's active subscription
    const subscription = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT * FROM subscriptions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
        [req.user!.id, 'active'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!subscription) {
      // For development, create a mock active subscription if none exists
      if (!isStripeConfigured && allSubscriptions.length === 0) {
        console.log('Creating mock subscription for development testing...');
        
        const mockSubscriptionId = await new Promise<number>((resolve, reject) => {
          db.run(
            `INSERT INTO subscriptions (user_id, plan_id, status, stripe_subscription_id, monthly_credits) 
             VALUES (?, ?, ?, ?, ?)`,
            [req.user!.id, 'premium', 'active', 'sub_mock_development', 100],
            function (err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });
        
        // Immediately cancel the mock subscription
        await new Promise<void>((resolve, reject) => {
          db.run(
            'UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['cancelled', mockSubscriptionId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        
        res.json({ 
          message: 'Mock subscription cancelled successfully (development mode)',
          note: 'Configure Stripe for real subscription management'
        });
        return;
      }
      
      throw new HttpError('No active subscription found', 404);
    }

    // Cancel subscription in Stripe (only if configured)
    if (isStripeConfigured) {
      const cancelled = await paymentService.cancelSubscription(subscription.stripe_subscription_id);
      
      if (!cancelled) {
        throw new HttpError('Failed to cancel subscription', 500);
      }
    } else {
      console.log('Stripe not configured, skipping Stripe cancellation');
    }

    // Update subscription status
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['cancelled', subscription.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ 
      message: 'Subscription cancelled successfully',
      ...(isStripeConfigured ? {} : { note: 'Local cancellation only (Stripe not configured)' })
    });
  } catch (error) {
    next(error);
  }
});

// Webhook for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const body = req.body.toString();

    const event = await paymentService.constructWebhookEvent(body, signature) as Stripe.Event;

    console.log(`Received Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'invoice.payment_succeeded':
        await handleSubscriptionPaymentSuccess(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send('Webhook error');
  }
});

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;
  const metadata = paymentIntent.metadata;

  // Find payment record
  const payment = await new Promise<any>((resolve, reject) => {
    db.get(
      'SELECT * FROM payments WHERE stripe_payment_intent_id = ?',
      [paymentIntentId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  if (payment) {
    // Update payment status
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['completed', payment.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Add credits to user
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET credits = credits + ? WHERE id = ?',
        [payment.credits, payment.user_id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`Added ${payment.credits} credits to user ${payment.user_id}`);
  }
}

async function handleSubscriptionPaymentSuccess(invoice: any) {
  const subscriptionId = invoice.subscription;

  // Find subscription record
  const subscription = await new Promise<any>((resolve, reject) => {
    db.get(
      'SELECT * FROM subscriptions WHERE stripe_subscription_id = ?',
      [subscriptionId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  if (subscription) {
    // Update subscription status to active
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['active', subscription.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Add monthly credits to user
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET credits = credits + ? WHERE id = ?',
        [subscription.monthly_credits, subscription.user_id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`Added ${subscription.monthly_credits} monthly credits to user ${subscription.user_id}`);
  }
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;

  // Update subscription status
  await new Promise<void>((resolve, reject) => {
    db.run(
      'UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE stripe_subscription_id = ?',
      ['cancelled', subscriptionId],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  console.log(`Subscription ${subscriptionId} cancelled`);
}

export { router as paymentRoutes };