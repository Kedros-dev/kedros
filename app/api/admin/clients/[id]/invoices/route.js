import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { sendScheduledInvoice, serializeInvoice } from "@/lib/scheduled-invoices";

export const dynamic = "force-dynamic";

const KINDS = ["SETUP_FEE", "CUSTOM"];
const DEFAULT_TITLES = {
  SETUP_FEE: "Setup fee",
  CUSTOM: "Invoice"
};

// Invoices scheduled within this window of "now" are sent immediately.
const SEND_NOW_GRACE_MS = 30 * 1000;

// List all scheduled and sent invoices for a client, newest first.
export async function GET(_request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.user.findUnique({ where: { id: params.id } });
  if (!client || client.role !== "CLIENT") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await prisma.scheduledInvoice.findMany({
    where: { userId: client.id },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ invoices: rows.map(serializeInvoice) });
}

// Build an invoice from line items and either send it now or schedule it.
export async function POST(request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.user.findUnique({ where: { id: params.id } });
  if (!client || client.role !== "CLIENT") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const kind = String(body.kind || "");
  if (kind === "MONTHLY") {
    return NextResponse.json({ error: "Set the monthly plan from the client details." }, { status: 400 });
  }
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: "Invoice kind must be setup fee or custom." }, { status: 400 });
  }

  if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
    return NextResponse.json({ error: "Add at least one line item." }, { status: 400 });
  }

  const lineItems = [];
  for (const item of body.lineItems) {
    const description = String(item?.description ?? "").trim();
    const amountCents = Math.round(Number(item?.amountDollars) * 100);
    if (!description) {
      return NextResponse.json({ error: "Every line item needs a description." }, { status: 400 });
    }
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { error: "Every line item needs an amount greater than zero." },
        { status: 400 }
      );
    }
    lineItems.push({ description, amountCents });
  }

  const totalCents = lineItems.reduce((sum, li) => sum + li.amountCents, 0);

  const now = new Date();
  let sendAt = now;
  if (body.sendAt !== undefined && body.sendAt !== null && body.sendAt !== "") {
    const parsed = new Date(body.sendAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Send date is not a valid date." }, { status: 400 });
    }
    if (parsed.getTime() - now.getTime() > SEND_NOW_GRACE_MS) {
      sendAt = parsed;
    }
  }
  const sendNow = sendAt === now;

  const parsedDays = Math.round(Number(body.daysUntilDue));
  const daysUntilDue = Number.isFinite(parsedDays) ? Math.min(90, Math.max(1, parsedDays)) : 7;

  const title = String(body.title ?? "").trim() || DEFAULT_TITLES[kind];
  const memo = String(body.memo ?? "").trim() || null;

  const row = await prisma.scheduledInvoice.create({
    data: {
      userId: client.id,
      kind,
      title,
      lineItems,
      totalCents,
      memo,
      daysUntilDue,
      sendAt,
      status: "SCHEDULED"
    }
  });

  if (!sendNow) {
    return NextResponse.json({ ok: true, invoice: serializeInvoice(row) });
  }

  const result = await sendScheduledInvoice(row.id);
  const updated = result || (await prisma.scheduledInvoice.findUnique({ where: { id: row.id } }));

  if (updated.status === "FAILED") {
    return NextResponse.json(
      { error: updated.error || "Could not send the invoice." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, invoice: serializeInvoice(updated) });
}
