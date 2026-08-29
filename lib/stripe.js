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

// Create a one-off invoice for the client, finalize it, and email it via Stripe.
// Used for the setup fee and any later ad-hoc charges. Returns the invoice.
export async function createAndSendInvoice(prisma, user, amountCents, description) {
  const customerId = await ensureStripeCustomer(prisma, user);

  await stripe.invoiceItems.create({
    customer: customerId,
    amount: amountCents,
    currency: "usd",
    description
  });

  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: 7,
    description,
    auto_advance: true,
    metadata: { userId: user.id }
  });

  await stripe.invoices.finalizeInvoice(invoice.id);
  return stripe.invoices.sendInvoice(invoice.id);
}
