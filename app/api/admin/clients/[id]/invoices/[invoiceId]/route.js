import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Cancel a scheduled or failed invoice. Rows are kept for the record, not deleted.
export async function DELETE(_request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.user.findUnique({ where: { id: params.id } });
  if (!client || client.role !== "CLIENT") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const invoice = await prisma.scheduledInvoice.findUnique({ where: { id: params.invoiceId } });
  if (!invoice || invoice.userId !== client.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Conditional update so a row claimed by the sweep in the meantime is not canceled.
  const result = await prisma.scheduledInvoice.updateMany({
    where: { id: invoice.id, status: { in: ["SCHEDULED", "FAILED"] } },
    data: { status: "CANCELED" }
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "Only scheduled or failed invoices can be canceled." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
