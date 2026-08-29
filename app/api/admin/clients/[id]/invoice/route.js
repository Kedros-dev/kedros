import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { createAndSendInvoice } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Bill a client an ad-hoc amount: creates, finalizes and emails a Stripe invoice.
export async function POST(request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.user.findUnique({ where: { id: params.id } });
  if (!client || client.role !== "CLIENT") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const amountCents = Math.round(Number(body.amountDollars || 0) * 100);
  const description = String(body.description || "").trim();

  if (amountCents <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "A description is required." }, { status: 400 });
  }

  try {
    const invoice = await createAndSendInvoice(prisma, client, amountCents, description);
    return NextResponse.json({
      ok: true,
      invoice: { id: invoice.id, number: invoice.number, hostedInvoiceUrl: invoice.hosted_invoice_url }
    });
  } catch (err) {
    console.error("Invoice creation failed:", err.message);
    return NextResponse.json({ error: "Could not create the invoice." }, { status: 502 });
  }
}
