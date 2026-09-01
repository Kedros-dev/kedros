import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { mapInvoice } from "@/lib/invoices";
import AccountView from "./AccountView";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");
  if (!session.user.isActive) redirect("/login?error=deactivated");
  if (session.user.mustChangePassword) redirect("/account/change-password");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  let invoices = [];
  if (user.stripeCustomerId) {
    try {
      const list = await stripe.invoices.list({ customer: user.stripeCustomerId, limit: 20 });
      invoices = list.data.map(mapInvoice);
    } catch {
      invoices = [];
    }
  }

  return (
    <AccountView
      user={{
        name: user.name,
        oneTimeAmountCents: user.oneTimeAmountCents,
        oneTimePaidAt: user.oneTimePaidAt,
        monthlyAmountCents: user.monthlyAmountCents,
        subscriptionStatus: user.subscriptionStatus
      }}
      invoices={invoices}
    />
  );
}
