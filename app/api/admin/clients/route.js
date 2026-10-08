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
      monthlyStartAt: true,
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

  // Validate invoice timing and the monthly plan before anything is created in the DB or Stripe.
  const now = new Date();
  const setupPlan = planClientInvoice({
    kind: "SETUP_FEE",
    amountCents: oneTimeAmountCents,
    mode: setupMode,
    at: setupSendAt,
    now
  });
  if (setupPlan?.error) {
    return NextResponse.json({ error: setupPlan.error }, { status: 400 });
  }

  // "signup": the client subscribes from their account page (card charged then).
  // "schedule": the client subscribes from their account page, and the first charge
  // happens on monthlyStartAt (the card is still collected at signup).
  const planMode = monthlyMode === undefined || monthlyMode === null || monthlyMode === "" ? "signup" : monthlyMode;
  if (planMode !== "signup" && planMode !== "schedule") {
    return NextResponse.json({ error: "Monthly start option is invalid." }, { status: 400 });
  }

  let monthlyStartDate = null;
  if (planMode === "schedule") {
    if (monthlyStartAt === undefined || monthlyStartAt === null || monthlyStartAt === "") {
      return NextResponse.json({ error: "Choose a start date for the monthly plan." }, { status: 400 });
    }
    const parsed = new Date(monthlyStartAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Monthly start date is not a valid date." }, { status: 400 });
    }
    if (parsed.getTime() <= now.getTime()) {
      return NextResponse.json({ error: "Monthly start date must be in the future." }, { status: 400 });
    }
    monthlyStartDate = parsed;
  }
  const storedMonthlyStartAt = monthlyAmountCents > 0 ? monthlyStartDate : null;

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
      monthlyStartAt: storedMonthlyStartAt,
      stripeCustomerId: customer.id,
      mustChangePassword: true
    }
  });

  const invoices = {
    setup: await createClientInvoice(client.id, setupPlan)
  };

  return NextResponse.json({
    client: { id: client.id, name: client.name, email: client.email },
    tempPassword,
    invoices
  });
}
