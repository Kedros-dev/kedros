import Stripe from "stripe";

let instance;

function client() {
  if (!instance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    instance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20"
    });
  }
  return instance;
}

// Lazily instantiate so importing this module never throws at build time
// (e.g. while Next collects page data) when STRIPE_SECRET_KEY is absent.
export const stripe = new Proxy(
  {},
  {
    get(_target, prop) {
      const value = client()[prop];
      return typeof value === "function" ? value.bind(client()) : value;
    }
  }
);

// Return the client's existing Stripe customer id, creating and persisting one
// on first use so subscriptions and a future billing portal have a stable customer.
export async function ensureStripeCustomer(prisma, user) {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id }
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id }
  });

  return customer.id;
}
