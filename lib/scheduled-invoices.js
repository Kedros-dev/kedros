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

// Same grace window as the admin invoices route: a date this close to "now" is sent immediately.
const CLIENT_SEND_NOW_GRACE_MS = 30 * 1000;
const CLIENT_INVOICE_TITLES = { SETUP_FEE: "Setup fee", MONTHLY: "Monthly subscription" };
const TIMING_MODES = ["now", "schedule", "none"];

// Work out whether and when a client's setup-fee or monthly invoice should go out.
// Returns null when nothing should be created (no amount, or mode "none"),
// { error } when the input is invalid, or a plan for createClientInvoice().
export function planClientInvoice({ kind, amountCents, mode, at, now = new Date() }) {
  if (!(amountCents > 0)) return null;

  const chosen = mode === undefined || mode === null || mode === "" ? "now" : String(mode);
  if (!TIMING_MODES.includes(chosen)) return { error: "Invalid timing option." };
  if (chosen === "none") return null;

  const title = CLIENT_INVOICE_TITLES[kind];
  let sendAt = now;
  let sendNow = true;

  if (chosen === "schedule") {
    if (at === undefined || at === null || at === "") {
      return { error: `Choose a date for the ${title.toLowerCase()}.` };
    }
    const parsed = new Date(at);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Scheduled date is not a valid date." };
    }
    if (parsed.getTime() - now.getTime() > CLIENT_SEND_NOW_GRACE_MS) {
      sendAt = parsed;
      sendNow = false;
    }
  }

  return {
    kind,
    title,
    lineItems: [{ description: title, amountCents }],
    totalCents: amountCents,
    sendAt,
    sendNow
  };
}

// Create the ScheduledInvoice row for a plan from planClientInvoice and, when it
// is due now, send it. A send failure is recorded on the row and never thrown.
// Returns { status, sendAt, error } using the row's final state, or null.
export async function createClientInvoice(userId, plan) {
  if (!plan || plan.error) return null;

  let row = await prisma.scheduledInvoice.create({
    data: {
      userId,
      kind: plan.kind,
      title: plan.title,
      lineItems: plan.lineItems,
      totalCents: plan.totalCents,
      daysUntilDue: 7,
      sendAt: plan.sendAt,
      status: "SCHEDULED"
    }
  });

  if (plan.sendNow) {
    try {
      const sent = await sendScheduledInvoice(row.id);
      row = sent || (await prisma.scheduledInvoice.findUnique({ where: { id: row.id } })) || row;
    } catch (err) {
      console.error(`Immediate send of scheduled invoice ${row.id} failed:`, err.message);
      row = (await prisma.scheduledInvoice.findUnique({ where: { id: row.id } })) || row;
    }
  }

  return {
    status: row.status,
    sendAt: row.sendAt.toISOString(),
    error: row.error ?? null
  };
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
