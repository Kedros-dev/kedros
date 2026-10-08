import { prisma } from "@/lib/prisma";
import { stripe, ensureStripeCustomer, createAndSendInvoice } from "@/lib/stripe";

// Send one scheduled invoice. Claims the row atomically so a sweep and a
// send-now request can never both send it. Returns the updated row, or null
// if the row was not in SCHEDULED state (already claimed, sent, or canceled).
export async function sendScheduledInvoice(id) {
  const claim = await prisma.scheduledInvoice.updateMany({
    where: { id, status: "SCHEDULED" },
    data: { status: "SENDING" }
  });
  if (claim.count === 0) return null;

  const row = await prisma.scheduledInvoice.findUnique({
    where: { id },
    include: { user: true }
  });

  try {
    const user = row.user;
    let update;

    if (row.kind === "MONTHLY") {
      if (user.subscriptionStatus === "ACTIVE") {
        throw new Error("Client already has an active subscription.");
      }

      const customerId = await ensureStripeCustomer(prisma, user);
      const lineItems = Array.isArray(row.lineItems) ? row.lineItems : [];

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        collection_method: "send_invoice",
        days_until_due: row.daysUntilDue,
        items: lineItems.map((li) => ({
          price_data: {
            currency: "usd",
            unit_amount: li.amountCents,
            recurring: { interval: "month" },
            product_data: { name: li.description }
          }
        })),
        metadata: { userId: user.id, kind: "monthly", scheduledInvoiceId: row.id },
        expand: ["latest_invoice"]
      });

      const latest = subscription.latest_invoice;
      const latestInvoice = latest && typeof latest === "object" ? latest : null;

      // Best-effort explicit send of the first invoice, mirroring createAndSendInvoice.
      if (latestInvoice?.id && latestInvoice.status === "open") {
        try {
          await stripe.invoices.sendInvoice(latestInvoice.id);
        } catch (err) {
          console.warn("Subscription invoice email not sent:", err.message);
        }
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionId: subscription.id,
          subscriptionStatus: "ACTIVE",
          monthlyAmountCents: row.totalCents
        }
      });

      update = {
        stripeInvoiceId: latestInvoice?.id ?? null,
        stripeSubscriptionId: subscription.id,
        hostedInvoiceUrl: latestInvoice?.hosted_invoice_url ?? null
      };
    } else {
      const lineItems = Array.isArray(row.lineItems) ? row.lineItems : [];

      const { invoice } = await createAndSendInvoice(prisma, user, {
        lineItems,
        description: row.title,
        memo: row.memo || undefined,
        daysUntilDue: row.daysUntilDue,
        metadata: {
          scheduledInvoiceId: row.id,
          kind: row.kind === "SETUP_FEE" ? "setup_fee" : "custom"
        }
      });

      update = {
        stripeInvoiceId: invoice.id,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null
      };
    }

    return await prisma.scheduledInvoice.update({
      where: { id },
      data: { ...update, status: "SENT", sentAt: new Date(), error: null }
    });
  } catch (err) {
    console.error(`Scheduled invoice ${id} failed:`, err.message);
    return await prisma.scheduledInvoice.update({
      where: { id },
      data: { status: "FAILED", error: err.message }
    });
  }
}

// Send every SCHEDULED invoice whose sendAt has passed. Sequential, so one bad
// row never blocks the rest; each failure is recorded on its row.
export async function processDueInvoices() {
  const due = await prisma.scheduledInvoice.findMany({
    where: { status: "SCHEDULED", sendAt: { lte: new Date() } },
    orderBy: { sendAt: "asc" },
    take: 20,
    select: { id: true }
  });

  for (const { id } of due) {
    try {
      await sendScheduledInvoice(id);
    } catch (err) {
      console.error(`Processing scheduled invoice ${id} failed:`, err.message);
    }
  }
}

// Shape a ScheduledInvoice row for the admin UI.
export function serializeInvoice(row) {
  const lineItems = Array.isArray(row.lineItems) ? row.lineItems : [];
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    lineItems: lineItems.map((li) => ({
      description: li.description,
      amountCents: li.amountCents
    })),
    totalCents: row.totalCents,
    memo: row.memo ?? null,
    daysUntilDue: row.daysUntilDue,
    sendAt: row.sendAt.toISOString(),
    status: row.status,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    hostedInvoiceUrl: row.hostedInvoiceUrl ?? null,
    error: row.error ?? null
  };
}
