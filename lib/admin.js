import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Returns the session for an authenticated admin, or null.
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}
