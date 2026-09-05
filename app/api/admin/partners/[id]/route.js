import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Rename a partner and/or activate/deactivate them. Partners are never hard-deleted so that
// historical splits on existing clients keep resolving to a real name.
export async function PATCH(request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const partner = await prisma.partner.findUnique({ where: { id: params.id } });
  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const data = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.active === "boolean") data.active = body.active;

  const updated = await prisma.partner.update({ where: { id: partner.id }, data });
  return NextResponse.json({ partner: updated });
}
