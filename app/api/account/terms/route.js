import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TERMS_VERSION } from "@/lib/terms";

export const dynamic = "force-dynamic";

// Client acceptance of the service terms.
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.user.isActive) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  if (body?.accepted !== true) {
    return NextResponse.json({ error: "Terms must be accepted." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, loginCount: true }
  });
  if (!user || user.role !== "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
      termsAcceptedAtLogin: user.loginCount
    }
  });

  return NextResponse.json({ ok: true });
}
