import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendScheduledInvoice, serializeInvoice } from "@/lib/scheduled-invoices";

export const dynamic = "force-dynamic";

// A send time this close to "now" (or in the past) means send immediately.
const SEND_NOW_GRACE_MS = 30 * 1000;

// Rows that can be edited in place. SENT rows are replaced by a new invoice.
const EDITABLE_STATUSES = ["SCHEDULED", "FAILED"];

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status });
}

// Admin check, client lookup (role CLIENT) and invoice ownership, in one place.
// Returns { response } when the request must stop, otherwise { client, invoice }.
async function loadClientInvoice(params) {
  if (!(await requireAdmin())) {
    return { response: jsonError("Unauthorized", 401) };
  }

  const client = await prisma.user.findUnique({ where: { id: params.id } });
  if (!client || client.role !== "CLIENT") {
    return { response: jsonError("Not found", 404) };
  }

  const invoice = await prisma.scheduledInvoice.findUnique({ where: { id: params.invoiceId } });
  if (!invoice || invoice.userId !== client.id) {
    return { response: jsonError("Not found", 404) };
  }

  return { client, invoice };
}

// Same rules as the POST route: description required, amount 0 or more (blank is invalid),
// stored as integer cents. The invoice total must be above $0.
function parseLineItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Add at least one line item." };
  }

  const lineItems = [];
  for (const item of raw) {
    const description = String(item?.description ?? "").trim();
    const blank = String(item?.amountDollars ?? "").trim() === "";
    const amountCents = blank ? NaN : Math.round(Number(item.amountDollars) * 100);
    if (!description) {
      return { error: "Every line item needs a description." };
    }
    if (!Number.isFinite(amountCents) || amountCents < 0) {
      return { error: "Every line item needs an amount of 0 or more." };
    }
    lineItems.push({ description, amountCents });
  }

  const totalCents = lineItems.reduce((sum, li) => sum + li.amountCents, 0);
  if (totalCents <= 0) {
    return { error: "The invoice total must be more than $0." };
  }
  return { lineItems, totalCents };
}

// Decide when the invoice goes out. raw is the body's sendAt: undefined keeps
// `fallback`, null or "" means now, anything else must parse as a date.
function resolveSendAt(raw, fallback, now) {
  let base;
  if (raw === undefined) {
    base = fallback;
  } else if (raw === null || raw === "") {
    base = now;
  } else {
    base = new Date(raw);
    if (Number.isNaN(base.getTime())) {
      return { error: "Send date is not a valid date." };
    }
  }

  if (base.getTime() - now.getTime() <= SEND_NOW_GRACE_MS) {
    return { sendAt: now, sendNow: true };
  }
  return { sendAt: base, sendNow: false };
}

// Days until due are clamped to 1-90. A missing or non-numeric value keeps the current one.
function resolveDaysUntilDue(raw, fallback) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = Math.round(Number(raw));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(90, Math.max(1, parsed));
}

// Look up the Stripe invoice and void it if it is still open. Returns an error
// message when the invoice can't be changed, or null when it is now void.
// Throws if the Stripe call itself fails.
async function voidStripeInvoice(stripeInvoiceId, paidMessage) {
  const remote = await stripe.invoices.retrieve(stripeInvoiceId);
  if (remote.status === "paid") return paidMessage;
  if (remote.status === "open") {
    await stripe.invoices.voidInvoice(stripeInvoiceId);
    return null;
  }
  if (remote.status === "void") return null;
  return `This invoice can't be changed (Stripe status: ${remote.status}).`;
}

// Setup fee amounts are mirrored on the client so the account page shows the same total.
async function syncSetupFeeAmount(client, invoice, totalCents) {
  if (invoice.kind !== "SETUP_FEE") return;
  await prisma.user.update({
    where: { id: client.id },
    data: { oneTimeAmountCents: totalCents }
  });
}

// Edit an invoice's line items, memo, title, due days and send time.
// SCHEDULED/FAILED rows are updated in place. A SENT row is voided in Stripe and
// replaced by a new row. Body: { lineItems, memo?, title?, daysUntilDue?, sendAt? }.
export async function PATCH(request, { params }) {
  const loaded = await loadClientInvoice(params);
  if (loaded.response) return loaded.response;
  const { client, invoice } = loaded;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body.", 400);
  }

  if (invoice.kind === "MONTHLY") {
    return jsonError("Monthly invoices can't be edited here.", 400);
  }
  if (invoice.status === "SENDING") {
    return jsonError("Invoice is already being sent.", 400);
  }
  if (!EDITABLE_STATUSES.includes(invoice.status) && invoice.status !== "SENT") {
    return jsonError("Canceled invoices can't be edited.", 400);
  }
  if (invoice.kind === "SETUP_FEE" && client.oneTimePaidAt) {
    return jsonError("The setup fee is already paid.", 400);
  }

  const items = parseLineItems(body.lineItems);
  if (items.error) return jsonError(items.error, 400);

  const now = new Date();
  // A SENT row is replaced, so its new send time defaults to now. Other rows keep their send time.
  const timing = resolveSendAt(body.sendAt, invoice.status === "SENT" ? now : invoice.sendAt, now);
  if (timing.error) return jsonError(timing.error, 400);

  const title = String(body.title ?? "").trim() || invoice.title;
  const memo = body.memo === undefined ? invoice.memo : (String(body.memo ?? "").trim() || null);
  const daysUntilDue = resolveDaysUntilDue(body.daysUntilDue, invoice.daysUntilDue);

  if (invoice.status === "SENT") {
    if (!invoice.stripeInvoiceId) {
      return jsonError("This invoice can't be edited.", 400);
    }

    let stripeError;
    try {
      stripeError = await voidStripeInvoice(
        invoice.stripeInvoiceId,
        "This invoice is already paid and can't be changed."
      );
    } catch (err) {
      return jsonError(`Could not update the invoice in Stripe: ${err.message}`, 502);
    }
    if (stripeError) return jsonError(stripeError, 400);

    // Conditional update so the row is only replaced while it is still SENT.
    const replaced = await prisma.scheduledInvoice.updateMany({
      where: { id: invoice.id, status: "SENT" },
      data: { status: "CANCELED", error: "Replaced by an updated invoice" }
    });
    if (replaced.count === 0) {
      return jsonError("This invoice changed while it was being updated. Reload and try again.", 400);
    }

    await syncSetupFeeAmount(client, invoice, items.totalCents);

    const created = await prisma.scheduledInvoice.create({
      data: {
        userId: client.id,
        kind: invoice.kind,
        title,
        lineItems: items.lineItems,
        totalCents: items.totalCents,
        memo,
        daysUntilDue,
        sendAt: timing.sendAt,
        status: "SCHEDULED"
      }
    });

    let row = created;
    if (timing.sendNow) {
      const sent = await sendScheduledInvoice(created.id);
      row = sent || (await prisma.scheduledInvoice.findUnique({ where: { id: created.id } }));

      if (row.status === "FAILED") {
        return jsonError(
          `The old invoice was voided but the new one could not be sent: ${row.error || "unknown error"}`,
          502
        );
      }
    }

    return NextResponse.json({ ok: true, replaced: true, invoice: serializeInvoice(row) });
  }

  // SCHEDULED or FAILED: update in place. The conditional update fails if the sweep
  // claimed the row in the meantime.
  const updated = await prisma.scheduledInvoice.updateMany({
    where: { id: invoice.id, status: { in: EDITABLE_STATUSES } },
    data: {
      lineItems: items.lineItems,
      totalCents: items.totalCents,
      memo,
      title,
      daysUntilDue,
      sendAt: timing.sendAt,
      status: "SCHEDULED",
      error: null
    }
  });
  if (updated.count === 0) {
    return jsonError("Invoice is already being sent.", 400);
  }

  await syncSetupFeeAmount(client, invoice, items.totalCents);

  let row = await prisma.scheduledInvoice.findUnique({ where: { id: invoice.id } });
  if (timing.sendNow) {
    const sent = await sendScheduledInvoice(invoice.id);
    row = sent || (await prisma.scheduledInvoice.findUnique({ where: { id: invoice.id } }));

    if (row.status === "FAILED") {
      return jsonError(row.error || "Could not send the invoice.", 502);
    }
  }

  return NextResponse.json({ ok: true, replaced: false, invoice: serializeInvoice(row) });
}

// Cancel a scheduled or failed invoice, or void a sent one in Stripe.
// Rows are kept for the record, not deleted.
export async function DELETE(_request, { params }) {
  const loaded = await loadClientInvoice(params);
  if (loaded.response) return loaded.response;
  const { invoice } = loaded;

  if (invoice.status === "SENT") {
    if (!invoice.stripeInvoiceId) {
      return jsonError("This invoice can't be voided.", 400);
    }

    let stripeError;
    try {
      stripeError = await voidStripeInvoice(invoice.stripeInvoiceId, "Already paid, nothing to void.");
    } catch (err) {
      return jsonError(`Could not void the invoice in Stripe: ${err.message}`, 502);
    }
    if (stripeError) return jsonError(stripeError, 400);

    const voided = await prisma.scheduledInvoice.updateMany({
      where: { id: invoice.id, status: "SENT" },
      data: { status: "CANCELED", error: "Voided by admin" }
    });
    if (voided.count === 0) {
      return jsonError("This invoice changed while it was being voided. Reload and try again.", 400);
    }

    return NextResponse.json({ ok: true, voided: true });
  }

  // Conditional update so a row claimed by the sweep in the meantime is not canceled.
  const result = await prisma.scheduledInvoice.updateMany({
    where: { id: invoice.id, status: { in: EDITABLE_STATUSES } },
    data: { status: "CANCELED" }
  });

  if (result.count === 0) {
    return jsonError("Only scheduled, failed or sent invoices can be canceled.", 400);
  }

  return NextResponse.json({ ok: true });
}
