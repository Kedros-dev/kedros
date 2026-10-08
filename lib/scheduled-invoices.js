import { prisma } from "@/lib/prisma";
import { createAndSendInvoice } from "@/lib/stripe";
import { emailConfigured } from "@/lib/email";

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

    // The monthly plan is no longer emailed as an invoice; the client subscribes
    // from their account page instead. Old MONTHLY rows are failed, not re-sent.
    if (row.kind === "MONTHLY") {
      throw new Error("Monthly plans are no longer sent as invoices. Ask the client to subscribe from their account page.");
    }

    const lineItems = Array.isArray(row.lineItems) ? row.lineItems : [];

    const { invoice, emailed, emailError } = await createAndSendInvoice(prisma, user, {
      lineItems,
      description: row.title,
      memo: row.memo || undefined,
      daysUntilDue: row.daysUntilDue,
      metadata: {
        scheduledInvoiceId: row.id,
        kind: row.kind === "SETUP_FEE" ? "setup_fee" : "custom"
      }
    });

    // The invoice exists either way, so the row stays SENT. A failed email is kept
    // as a non-fatal note so the admin can see the client was not emailed.
    const note =
      !emailed && emailConfigured() ? `Invoice created, but the email was not sent: ${emailError || "unknown error"}` : null;

    const update = {
      stripeInvoiceId: invoice.id,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null
    };

    return await prisma.scheduledInvoice.update({
      where: { id },
      data: { ...update, status: "SENT", sentAt: new Date(), error: note }
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
const CLIENT_INVOICE_TITLES = { SETUP_FEE: "Setup fee" };
const TIMING_MODES = ["now", "schedule", "none"];

// Work out whether and when a client's setup-fee invoice should go out.
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
