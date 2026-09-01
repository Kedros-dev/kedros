import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Cancel a client's subscription immediately.
export async function DELETE(_request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.user.findUnique({ where: { id: params.id } });
  if (!client || client.role !== "CLIENT") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!client.subscriptionId) {
    return NextResponse.json({ error: "No active subscription." }, { status: 400 });
  }

  try {
    await stripe.subscriptions.cancel(client.subscriptionId);
  } catch (err) {
    console.error("Subscription cancel failed:", err.message);
    return NextResponse.json({ error: "Could not cancel the subscription." }, { status: 502 });
  }

  await prisma.user.update({
    where: { id: client.id },
    data: { subscriptionStatus: "CANCELED" }
  });

  return NextResponse.json({ ok: true });
}
