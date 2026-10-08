import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { planClientInvoice, createClientInvoice } from "@/lib/scheduled-invoices";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clients = await prisma.user.findMany({
    where: { role: "CLIENT" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      oneTimeAmountCents: true,
      monthlyAmountCents: true,
      oneTimePaidAt: true,
      subscriptionStatus: true,
      subscriptionId: true,
      isActive: true,
      createdAt: true
    }
  });

  return NextResponse.json({ clients });
}

export async function POST(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    name,
    email,
    oneTimeAmountDollars,
    monthlyAmountDollars,
    setupMode,
    setupSendAt,
    monthlyMode,
    monthlyStartAt
  } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  const oneTimeAmountCents = Math.round(Number(oneTimeAmountDollars || 0) * 100);
  const monthlyAmountCents = Math.round(Number(monthlyAmountDollars || 0) * 100);

  if (oneTimeAmountCents < 0 || monthlyAmountCents < 0) {
    return NextResponse.json({ error: "Amounts must be positive." }, { status: 400 });
  }

  // Validate invoice timing before anything is created in the DB or Stripe.
  const now = new Date();
  const setupPlan = planClientInvoice({
    kind: "SETUP_FEE",
    amountCents: oneTimeAmountCents,
    mode: setupMode,
    at: setupSendAt,
    now
  });
  const monthlyPlan = planClientInvoice({
    kind: "MONTHLY",
    amountCents: monthlyAmountCents,
    mode: monthlyMode,
    at: monthlyStartAt,
    now
  });
  const timingError = setupPlan?.error || monthlyPlan?.error;
  if (timingError) {
    return NextResponse.json({ error: timingError }, { status: 400 });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const tempPassword = crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const customer = await stripe.customers.create({
    name,
    email: normalizedEmail
  });

  const client = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      role: "CLIENT",
      oneTimeAmountCents,
      monthlyAmountCents,
      stripeCustomerId: customer.id,
      mustChangePassword: true
    }
  });

  const invoices = {
    setup: await createClientInvoice(client.id, setupPlan),
    monthly: await createClientInvoice(client.id, monthlyPlan)
  };

  return NextResponse.json({
    client: { id: client.id, name: client.name, email: client.email },
    tempPassword,
    invoices
  });
}
