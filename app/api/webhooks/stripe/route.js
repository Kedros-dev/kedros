import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { emailConfigured, sendEmail, receiptEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Email the client a receipt for a paid subscription invoice. Never throws: a
// failure is logged and the dedup row removed so a webhook retry can resend it.
async function sendSubscriptionReceipt(invoice) {
  if (!emailConfigured()) return;

  const or = [];
  if (invoice.customer) or.push({ stripeCustomerId: invoice.customer });
  if (invoice.subscription) or.push({ subscriptionId: invoice.subscription });
  if (or.length === 0) return;

  const user = await prisma.user.findFirst({ where: { OR: or } });
  if (!user || !user.email) return;

  const key = `receipt:${invoice.id}`;
  try {
    await prisma.emailLog.create({ data: { key } });
  } catch (err) {
    if (err?.code === "P2002") return; // Already sent for this invoice.
    throw err;
  }

  try {
    const firstLine = invoice.lines?.data?.[0]?.description;
    const paidTs = invoice.status_transitions?.paid_at;
    const message = receiptEmail({
      name: user.name,
      amountCents: invoice.amount_paid,
      description: firstLine || "Monthly subscription",
      paidAt: paidTs ? new Date(paidTs * 1000) : new Date(),
      invoiceUrl: invoice.hosted_invoice_url,
      pdfUrl: invoice.invoice_pdf
    });
    await sendEmail({ to: user.email, ...message });
  } catch (err) {
    console.error(`Receipt email for invoice ${invoice.id} failed:`, err.message);
    await prisma.emailLog.delete({ where: { key } }).catch(() => {});
  }
}

function mapSubscriptionStatus(stripeStatus) {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "ACTIVE";
  if (stripeStatus === "past_due" || stripeStatus === "unpaid") return "PAST_DUE";
  return "CANCELED";
}

export async function POST(request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (!userId) break;

      if (session.customer) {
        await prisma.user
          .update({ where: { id: userId }, data: { stripeCustomerId: session.customer } })
          .catch(() => {});
      }

      if (session.metadata.type === "one_time") {
        await prisma.user.update({
          where: { id: userId },
          data: { oneTimePaidAt: new Date() }
        });
      } else if (session.metadata.type === "subscription" && session.subscription) {
        await prisma.user.update({
          where: { id: userId },
          data: { subscriptionId: session.subscription, subscriptionStatus: "ACTIVE" }
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      await prisma.user.updateMany({
        where: { subscriptionId: subscription.id },
        data: { subscriptionStatus: mapSubscriptionStatus(subscription.status) }
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await prisma.user.updateMany({
        where: { subscriptionId: subscription.id },
        data: { subscriptionStatus: "CANCELED" }
      });
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      if (invoice.subscription) {
        await prisma.user.updateMany({
          where: { subscriptionId: invoice.subscription },
          data: { subscriptionStatus: "ACTIVE" }
        });
      }
      if (invoice.metadata?.kind === "setup_fee" && invoice.metadata.userId) {
        await prisma.user
          .update({ where: { id: invoice.metadata.userId }, data: { oneTimePaidAt: new Date() } })
          .catch(() => {});
      }
      if (invoice.subscription && invoice.amount_paid > 0) {
        try {
          await sendSubscriptionReceipt(invoice);
        } catch (err) {
          console.error("Subscription receipt failed:", err.message);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      if (invoice.subscription) {
        await prisma.user.updateMany({
          where: { subscriptionId: invoice.subscription },
          data: { subscriptionStatus: "PAST_DUE" }
        });
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
