import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, ensureStripeCustomer } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.isActive) return NextResponse.json({ error: "Account deactivated." }, { status: 403 });

  if (user.monthlyAmountCents <= 0) {
    return NextResponse.json({ error: "No monthly subscription configured for this account." }, { status: 400 });
  }
  if (user.subscriptionStatus === "ACTIVE") {
    return NextResponse.json({ error: "Subscription already active." }, { status: 400 });
  }

  const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL;
  const customerId = await ensureStripeCustomer(prisma, user);

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: user.monthlyAmountCents,
          recurring: { interval: "month" },
          product_data: {
            name: `Kedros: Monthly subscription (${user.name})`
          }
        },
        quantity: 1
      }
    ],
    success_url: `${origin}/account?subscribed=1`,
    cancel_url: `${origin}/account`,
    metadata: { userId: user.id, type: "subscription" }
  });

  return NextResponse.json({ url: checkoutSession.url });
}
