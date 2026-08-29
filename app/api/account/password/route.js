import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Client self-service password change.
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await request.json();

  if (!newPassword || String(newPassword).length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const valid = await bcrypt.compare(String(currentPassword || ""), user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(String(newPassword), 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false }
  });

  return NextResponse.json({ ok: true });
}
