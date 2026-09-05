import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ensurePartnersSeeded } from "@/lib/partnerSplit";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensurePartnersSeeded(prisma);

  const partners = await prisma.partner.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json({ partners });
}

export async function POST(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Partner name is required." }, { status: 400 });
  }

  const count = await prisma.partner.count();
  const partner = await prisma.partner.create({ data: { name, sortOrder: count } });

  return NextResponse.json({ partner });
}
