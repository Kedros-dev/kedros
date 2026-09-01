import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
