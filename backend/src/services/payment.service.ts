import Stripe from 'stripe';
import prisma from '../config/database.js';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { addCredits, CREDIT_PLANS } from '../middlewares/credits.js';

// Initialize Stripe instance
const stripe = new Stripe(config.stripe.secretKey);

export interface CreateCheckoutInput {
  storeId: string;
  planId: string;
  userId: string;
}

/**
 * Create a Stripe Checkout Session for credit purchase
 */
export const createCheckoutSession = async (input: CreateCheckoutInput) => {
  const { storeId, planId, userId } = input;

  // Find the plan
  const plan = CREDIT_PLANS.find((p) => p.id === planId);
  if (!plan) {
    throw AppError.badRequest('Invalid plan selected');
  }

  // Get store info
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
  });

  if (!store) {
    throw AppError.notFound('Store not found');
  }

  try {
    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: (plan.currency || 'USD').toLowerCase(),
            product_data: {
              name: `${plan.name} Plan`,
              description: `${plan.credits.toLocaleString()} AI Credits`,
            },
            unit_amount: plan.price * 100, // Amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${config.frontend.url}/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontend.url}/credits?canceled=true`,
      customer_email: store.user.email,
      metadata: {
        storeId,
        planId,
        credits: plan.credits.toString(),
        userId,
      },
    });

    // Save payment record in database
    const payment = await prisma.payment.create({
      data: {
        storeId,
        stripeSessionId: session.id,
        amount: plan.price * 100, // Amount in cents
        currency: (plan.currency || 'USD').toUpperCase(),
        status: 'PENDING',
        planId,
        credits: plan.credits,
        metadata: {
          planName: plan.name,
          planDescription: plan.description,
        },
      },
    });

    logger.info(`Checkout session created: ${session.id} for store: ${storeId}`);

    return {
      sessionId: session.id,
      url: session.url,
      publishableKey: config.stripe.publishableKey,
      plan,
    };
  } catch (error) {
    logger.error('Failed to create Stripe checkout session:', error);
    throw AppError.internal('Failed to create checkout session');
  }
};

/**
 * Verify payment after successful checkout
 */
export const verifyCheckoutSession = async (sessionId: string, storeId: string) => {
  // Get payment record
  const payment = await prisma.payment.findUnique({
    where: { stripeSessionId: sessionId },
  });

  if (!payment) {
    throw AppError.notFound('Payment not found');
  }

  if (payment.storeId !== storeId) {
    throw AppError.forbidden('Payment does not belong to this store');
  }

  if (payment.status === 'COMPLETED') {
    return { success: true, message: 'Payment already processed', credits: payment.credits };
  }

  try {
    // Verify session with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { success: false, message: 'Payment not completed', status: session.payment_status };
    }

    // Update payment record
    const updatedPayment = await prisma.payment.update({
      where: { stripeSessionId: sessionId },
      data: {
        stripePaymentIntentId: session.payment_intent as string,
        status: 'COMPLETED',
      },
    });

    // Add credits to the store
    const plan = CREDIT_PLANS.find((p) => p.id === payment.planId);
    const creditResult = await addCredits(
      storeId,
      payment.credits,
      `Purchased ${plan?.name || 'credit'} plan (${payment.credits} credits)`,
      session.payment_intent as string,
      {
        planId: payment.planId,
        price: payment.amount / 100,
        currency: payment.currency,
        stripeSessionId: sessionId,
      }
    );

    logger.info(`Payment verified and credits added: ${payment.credits} credits to store: ${storeId}`);

    return {
      success: true,
      message: 'Payment successful',
      credits: payment.credits,
      newBalance: creditResult.newBalance,
      payment: updatedPayment,
    };
  } catch (error) {
    logger.error('Failed to verify checkout session:', error);
    throw AppError.internal('Failed to verify payment');
  }
};

/**
 * Get payment history for a store
 */
export const getPaymentHistory = async (
  storeId: string,
  page: number = 1,
  limit: number = 20
) => {
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { storeId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payment.count({
      where: { storeId, status: 'COMPLETED' },
    }),
  ]);

  return {
    payments: payments.map((p) => ({
      id: p.id,
      sessionId: p.stripeSessionId,
      paymentIntentId: p.stripePaymentIntentId,
      amount: p.amount / 100, // Convert from cents
      currency: p.currency,
      credits: p.credits,
      planId: p.planId,
      status: p.status,
      createdAt: p.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Handle Stripe webhook events
 */
export const handleStripeWebhook = async (
  payload: Buffer,
  signature: string
) => {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      config.stripe.webhookSecret
    );
  } catch (err) {
    logger.error('Webhook signature verification failed:', err);
    throw AppError.badRequest('Invalid webhook signature');
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const storeId = session.metadata?.storeId;
      
      if (storeId && session.payment_status === 'paid') {
        // Get payment record
        const payment = await prisma.payment.findUnique({
          where: { stripeSessionId: session.id },
        });

        if (payment && payment.status !== 'COMPLETED') {
          // Update payment status
          await prisma.payment.update({
            where: { stripeSessionId: session.id },
            data: {
              stripePaymentIntentId: session.payment_intent as string,
              status: 'COMPLETED',
            },
          });

          // Add credits
          const plan = CREDIT_PLANS.find((p) => p.id === payment.planId);
          await addCredits(
            storeId,
            payment.credits,
            `Purchased ${plan?.name || 'credit'} plan (${payment.credits} credits)`,
            session.payment_intent as string,
            {
              planId: payment.planId,
              price: payment.amount / 100,
              currency: payment.currency,
            }
          );

          logger.info(`Webhook: Credits added for session: ${session.id}`);
        }
      }
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      await prisma.payment.updateMany({
        where: { stripeSessionId: session.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      logger.info(`Webhook: Session expired: ${session.id}`);
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      // Find payment by payment intent and mark as failed
      await prisma.payment.updateMany({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: {
          status: 'FAILED',
          failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
        },
      });
      logger.warn(`Webhook: Payment failed for intent: ${paymentIntent.id}`);
      break;
    }

    default:
      logger.info(`Webhook: Unhandled event type ${event.type}`);
  }

  return { received: true };
};
