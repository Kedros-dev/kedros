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
      subscriptionStatus: client.subscriptionStatus
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
  if (body.oneTimeAmountDollars !== undefined) {
    data.oneTimeAmountCents = Math.round(Number(body.oneTimeAmountDollars || 0) * 100);
  }
  if (body.monthlyAmountDollars !== undefined) {
    data.monthlyAmountCents = Math.round(Number(body.monthlyAmountDollars || 0) * 100);
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

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

