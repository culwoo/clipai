import Stripe from 'stripe';

export class PaymentService {
  private stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey || secretKey === 'your-stripe-secret-key-here') {
      console.warn('Stripe secret key not configured. Payment features will be disabled.');
      // Initialize with test key for development
      this.stripe = new Stripe('sk_test_dummy_key', { apiVersion: '2025-07-30.basil' });
    } else {
      this.stripe = new Stripe(secretKey, { apiVersion: '2025-07-30.basil' });
    }
  }

  /**
   * Convert amount to Stripe's expected format based on currency
   * Zero-decimal currencies (like KRW, JPY) don't need conversion
   * Decimal currencies (like USD, EUR) need to be multiplied by 100
   */
  private getStripeAmount(amount: number, currency: string): number {
    const zeroDecimalCurrencies = [
      'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 
      'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'
    ];
    
    if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
      return amount; // No conversion needed
    } else {
      return amount * 100; // Convert to cents/smallest unit
    }
  }

  async createPaymentIntent(amount: number, currency: string = 'krw', metadata: any = {}) {
    try {
      // Calculate amount based on currency (some currencies don't use cents)
      const stripeAmount = this.getStripeAmount(amount, currency);
      
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: stripeAmount,
        currency,
        automatic_payment_methods: { enabled: true },
        metadata,
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      throw new Error('Payment initialization failed');
    }
  }

  async createSubscription(customerId: string, priceId: string) {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      return {
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
      };
    } catch (error) {
      console.error('Failed to create subscription:', error);
      throw new Error('Subscription creation failed');
    }
  }

  async createCustomer(email: string, name?: string) {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
      });

      return customer.id;
    } catch (error) {
      console.error('Failed to create customer:', error);
      throw new Error('Customer creation failed');
    }
  }

  async confirmPayment(paymentIntentId: string) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent.status === 'succeeded';
    } catch (error) {
      console.error('Failed to confirm payment:', error);
      return false;
    }
  }

  async cancelSubscription(subscriptionId: string) {
    try {
      const subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      return subscription.status === 'canceled';
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      return false;
    }
  }

  async constructWebhookEvent(body: string, signature: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret === 'your-stripe-webhook-secret-here') {
      throw new Error('Webhook secret not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  // Credit packages for purchase
  getCreditPackages() {
    return [
      { credits: 10, price: 5000, priceId: 'price_10_credits' },
      { credits: 50, price: 20000, priceId: 'price_50_credits' },
      { credits: 100, price: 35000, priceId: 'price_100_credits' },
      { credits: 500, price: 150000, priceId: 'price_500_credits' },
    ];
  }

  // Subscription plans
  getSubscriptionPlans() {
    return [
      { 
        id: 'basic',
        name: 'Basic Plan', 
        price: 9900, 
        credits: 50, 
        priceId: 'price_basic_monthly',
        features: ['50 credits per month', 'Basic support', 'Standard processing']
      },
      { 
        id: 'pro',
        name: 'Pro Plan', 
        price: 29900, 
        credits: 200, 
        priceId: 'price_pro_monthly',
        features: ['200 credits per month', 'Priority support', 'Fast processing', 'Advanced features']
      },
      { 
        id: 'enterprise',
        name: 'Enterprise Plan', 
        price: 99900, 
        credits: 1000, 
        priceId: 'price_enterprise_monthly',
        features: ['1000 credits per month', '24/7 support', 'Fastest processing', 'All features', 'Custom integrations']
      },
    ];
  }
}

export const paymentService = new PaymentService();