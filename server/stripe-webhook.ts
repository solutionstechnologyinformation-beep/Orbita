import { Request, Response } from "express";
import stripe from "stripe";
import {
  createUserSubscription,
  updateUserSubscription,
  cancelUserSubscription,
  getUserSubscriptionByStripeId,
  createSubscriptionInvoice,
  updateSubscriptionInvoice,
  getSubscriptionPlanByStripePriceId,
} from "./db";

const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY || "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"] as string;

  let event: stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Test events for development
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`📨 Stripe Webhook: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`⚠️  Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error(`❌ Error processing webhook:`, error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}

async function handleCheckoutSessionCompleted(session: stripe.Checkout.Session) {
  console.log(`✅ Checkout completed for customer: ${session.customer}`);

  const userId = parseInt(session.client_reference_id || "0");
  const planId = parseInt(session.metadata?.plan_id || "0");
  const billingCycle = (session.metadata?.billing_cycle || "monthly") as "monthly" | "annual";

  if (!userId || !planId) {
    console.error("❌ Missing userId or planId in session metadata");
    return;
  }

  // Criar assinatura no banco de dados
  await createUserSubscription({
    userId,
    planId,
    stripeSubscriptionId: session.subscription as string,
    stripeCustomerId: session.customer as string,
    status: "active",
    billingCycle,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
    trialEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 dias
  });

  console.log(`✅ Subscription created for user ${userId}`);
}

async function handleSubscriptionCreated(subscription: stripe.Subscription) {
  console.log(`✅ Subscription created: ${subscription.id}`);

  const existingSub = await getUserSubscriptionByStripeId(subscription.id);
  if (existingSub) {
    console.log(`ℹ️  Subscription already exists in database`);
    return;
  }

  // Já foi criada no handleCheckoutSessionCompleted
}

async function handleSubscriptionUpdated(subscription: stripe.Subscription) {
  console.log(`🔄 Subscription updated: ${subscription.id}`);

  const sub = await getUserSubscriptionByStripeId(subscription.id);
  if (!sub) {
    console.error(`❌ Subscription not found: ${subscription.id}`);
    return;
  }

  // Atualizar status e datas
  await updateUserSubscription(sub.id, {
    status: subscription.status as any,
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
  });

  console.log(`✅ Subscription updated: ${subscription.id}`);
}

async function handleSubscriptionDeleted(subscription: stripe.Subscription) {
  console.log(`🗑️  Subscription deleted: ${subscription.id}`);

  const sub = await getUserSubscriptionByStripeId(subscription.id);
  if (!sub) {
    console.error(`❌ Subscription not found: ${subscription.id}`);
    return;
  }

  await cancelUserSubscription(sub.id, "Cancelado pelo usuário");
  console.log(`✅ Subscription canceled in database: ${subscription.id}`);
}

async function handleInvoicePaymentSucceeded(invoice: stripe.Invoice) {
  console.log(`💰 Invoice payment succeeded: ${invoice.id}`);

  const subscriptionId = typeof (invoice as any).subscription === "string" ? (invoice as any).subscription : ((invoice as any).subscription as any)?.id;
  if (!subscriptionId) {
    console.log(`ℹ️  Invoice has no subscription, skipping`);
    return;
  }

  const sub = await getUserSubscriptionByStripeId(subscriptionId);
  if (!sub) {
    console.error(`❌ Subscription not found for invoice: ${invoice.id}`);
    return;
  }

  // Criar ou atualizar fatura
  await createSubscriptionInvoice({
    userId: sub.userId,
    subscriptionId: sub.id,
    stripeInvoiceId: invoice.id,
    amount: invoice.total || 0,
    currency: invoice.currency?.toUpperCase() || "BRL",
    status: "paid",
    paidAt: new Date((invoice.status_transitions?.paid_at || Math.floor(Date.now() / 1000)) * 1000),
    dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : undefined,
    invoiceUrl: invoice.hosted_invoice_url || undefined,
  });

  console.log(`✅ Invoice recorded: ${invoice.id}`);
}

async function handleInvoicePaymentFailed(invoice: stripe.Invoice) {
  console.log(`❌ Invoice payment failed: ${invoice.id}`);

  const subscriptionId = typeof (invoice as any).subscription === "string" ? (invoice as any).subscription : ((invoice as any).subscription as any)?.id;
  if (!subscriptionId) {
    console.log(`ℹ️  Invoice has no subscription, skipping`);
    return;
  }

  const sub = await getUserSubscriptionByStripeId(subscriptionId);
  if (!sub) {
    console.error(`❌ Subscription not found for invoice: ${invoice.id}`);
    return;
  }

  // Atualizar status da assinatura para past_due
  await updateUserSubscription(sub.id, {
    status: "past_due",
  });

  console.log(`⚠️  Subscription marked as past_due: ${sub.id}`);
}
