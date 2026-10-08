import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { mapInvoice } from "@/lib/invoices";

export const dynamic = "force-dynamic";

// Client detail, including live invoice + subscription data from Stripe.
export async function GET(_request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.user.findUnique({ where: { id: params.id } });
  if (!client || client.role !== "CLIENT") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let invoices = [];
  let subscription = null;
  if (client.stripeCustomerId) {
    const list = await stripe.invoices.list({ customer: client.stripeCustomerId, limit: 20 });
    invoices = list.data.map(mapInvoice);
  }
  if (client.subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(client.subscriptionId);
      subscription = {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: sub.current_period_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end
      };
    } catch {
      subscription = null;
    }
  }

  return NextResponse.json({
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      isActive: client.isActive,
      mustChangePassword: client.mustChangePassword,
      oneTimeAmountCents: client.oneTimeAmountCents,
      monthlyAmountCents: client.monthlyAmountCents,
      subscriptionStatus: client.subscriptionStatus,
      monthlyStartAt: client.monthlyStartAt
    },
    invoices,
    subscription
  });
}

// Edit client fields and/or toggle active state.
export async function PATCH(request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.user.findUnique({ where: { id: params.id } });
  if (!client || client.role !== "CLIENT") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const data = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.email === "string" && body.email.trim()) {
    const email = body.email.toLowerCase().trim();
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash && clash.id !== client.id) {
      return NextResponse.json({ error: "Another user already has that email." }, { status: 409 });
    }
    data.email = email;
  }
  if (body.oneTimeAmountDollars !== undefined && !client.oneTimePaidAt) {
    data.oneTimeAmountCents = Math.round(Number(body.oneTimeAmountDollars || 0) * 100);
  }
  if (body.monthlyAmountDollars !== undefined) {
    data.monthlyAmountCents = Math.round(Number(body.monthlyAmountDollars || 0) * 100);
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.monthlyStartAt !== undefined) {
    if (body.monthlyStartAt === null || body.monthlyStartAt === "") {
      data.monthlyStartAt = null;
    } else {
      const parsed = new Date(body.monthlyStartAt);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Monthly start date is not a valid date." }, { status: 400 });
      }
      data.monthlyStartAt = parsed;
    }
  }

  if (
    (data.oneTimeAmountCents !== undefined && data.oneTimeAmountCents < 0) ||
    (data.monthlyAmountCents !== undefined && data.monthlyAmountCents < 0)
  ) {
    return NextResponse.json({ error: "Amounts must be positive." }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id: client.id }, data });

  if (client.stripeCustomerId && (data.name || data.email)) {
    try {
      await stripe.customers.update(client.stripeCustomerId, {
        name: updated.name,
        email: updated.email
      });
    } catch (err) {
      console.error("Failed to sync customer to Stripe:", err.message);
    }
  }

  return NextResponse.json({ ok: true, isActive: updated.isActive });
}

// Void a client's open invoices (so their payment links stop working) and delete
// their drafts (drafts cannot be voided). Paid invoices are never touched. Every
// Stripe call is best-effort: failures are logged and skipped.
async function retireUnpaidInvoices(customerId) {
  const MAX_PAGES = 5;
  for (const status of ["open", "draft"]) {
    let startingAfter;
    for (let page = 0; page < MAX_PAGES; page++) {
      let list;
      try {
        list = await stripe.invoices.list({
          customer: customerId,
          status,
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {})
        });
      } catch (err) {
        console.warn(`Could not list ${status} invoices on delete:`, err.message);
        break;
      }

      for (const inv of list.data) {
        try {
          if (status === "open") {
            await stripe.invoices.voidInvoice(inv.id);
          } else {
            await stripe.invoices.del(inv.id);
          }
        } catch (err) {
          console.warn(`Could not retire ${status} invoice ${inv.id} on delete:`, err.message);
        }
      }

      if (!list.has_more || list.data.length === 0) break;
      startingAfter = list.data[list.data.length - 1].id;
    }
  }
}

// Permanently remove a client account. Best-effort cancels their subscription and
// retires their unpaid invoices so payment links stop working. The Stripe customer
// and paid invoice history are left intact as the billing record.
export async function DELETE(_request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.user.findUnique({ where: { id: params.id } });
  if (!client || client.role !== "CLIENT") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (client.subscriptionId) {
    try {
      await stripe.subscriptions.cancel(client.subscriptionId);
    } catch (err) {
      console.warn("Could not cancel subscription on delete:", err.message);
    }
  }

  if (client.stripeCustomerId) {
    await retireUnpaidInvoices(client.stripeCustomerId);
  }

  await prisma.user.delete({ where: { id: client.id } });
  return NextResponse.json({ ok: true });
}

