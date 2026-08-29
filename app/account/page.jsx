import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AccountView from "./AccountView";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  return (
    <AccountView
      user={{
        name: user.name,
        oneTimeAmountCents: user.oneTimeAmountCents,
        monthlyAmountCents: user.monthlyAmountCents,
        oneTimePaidAt: user.oneTimePaidAt,
        subscriptionStatus: user.subscriptionStatus
      }}
    />
  );
}
