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

  const rules = await prisma.splitRule.findMany();
  return NextResponse.json({ rules });
}

// Bulk save the whole split-rule matrix from the admin panel's editor. Each entry is
// upserted by (broughtByPartnerId, supervisingRequired) since that pair isn't a DB-level
// unique constraint (a nullable FK can't be relied on for that in Postgres).
export async function PUT(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const entries = Array.isArray(body.rules) ? body.rules : [];

  const saved = await prisma.$transaction(
    entries.map((entry) => {
      const broughtByPartnerId = entry.broughtByPartnerId || null;
      const supervisingRequired = Boolean(entry.supervisingRequired);
      const splits = {};
      for (const [partnerId, percentage] of Object.entries(entry.splits || {})) {
        const value = Number(percentage);
        if (Number.isFinite(value) && value > 0) splits[partnerId] = value;
      }

      return prisma.splitRule.upsert({
        where: { id: entry.id || "__none__" },
        update: { broughtByPartnerId, supervisingRequired, splits },
        create: { broughtByPartnerId, supervisingRequired, splits }
      });
    })
  );

  return NextResponse.json({ rules: saved });
}
