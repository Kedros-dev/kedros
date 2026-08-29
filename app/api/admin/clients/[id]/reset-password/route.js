import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.user.findUnique({ where: { id: params.id } });
  if (!client || client.role !== "CLIENT") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tempPassword = crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id: client.id },
    data: { passwordHash, mustChangePassword: true }
  });

  return NextResponse.json({ email: client.email, tempPassword });
}
