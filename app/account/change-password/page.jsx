import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ChangePasswordView from "./ChangePasswordView";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");
  if (!session.user.isActive) redirect("/login?error=deactivated");

  return <ChangePasswordView forced={Boolean(session.user.mustChangePassword)} />;
}
