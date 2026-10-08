import Stripe from "stripe";
import { emailConfigured, sendEmail, invoiceEmail } from "@/lib/email";

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

// Create a one-off invoice for the client from line items, finalize it, and email
// a pay link via Resend (or Stripe's invoice email if Resend is not configured).
// lineItems is [{ description, amountCents }].
// Returns { invoice, emailed, emailError }.
export async function createAndSendInvoice(
  prisma,
  user,
  { lineItems, description, memo, daysUntilDue = 7, metadata = {} }
) {
  const customerId = await ensureStripeCustomer(prisma, user);

  // Create the invoice first, then attach each line item directly to it, so we
  // never depend on Stripe auto-pulling pending invoice items.
  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: daysUntilDue,
    description,
    footer: memo || undefined,
    auto_advance: true,
    pending_invoice_items_behavior: "exclude",
    metadata: { userId: user.id, ...metadata }
  });

  for (const item of lineItems) {
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: item.amountCents,
      currency: "usd",
      description: item.description
    });
  }

  // Finalizing produces the hosted payment page + PDF.
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

  if (emailConfigured()) {
    // Email the client ourselves through Resend, linking to the hosted payment page.
    // A failure here never throws: the invoice exists and its URL is in the admin UI.
    try {
      const totalCents = lineItems.reduce((sum, li) => sum + (Number(li.amountCents) || 0), 0);
      const message = invoiceEmail({
        name: user.name,
        title: description,
        lineItems,
        totalCents,
        dueDays: daysUntilDue,
        memo,
        payUrl: finalized.hosted_invoice_url
      });
      await sendEmail({ to: user.email, ...message });
      return { invoice: finalized, emailed: true, emailError: null };
    } catch (err) {
      console.error("Invoice email via Resend failed:", err.message);
      return { invoice: finalized, emailed: false, emailError: err.message };
    }
  }

  // Resend is not configured: fall back to Stripe's own invoice email. Sandbox or
  // unconfigured accounts reject this, but the invoice is still payable via
  // finalized.hosted_invoice_url.
  try {
    const sent = await stripe.invoices.sendInvoice(invoice.id);
    return { invoice: sent, emailed: true, emailError: null };
  } catch (err) {
    console.warn("Invoice email not sent (account not configured for sending):", err.message);
    return { invoice: finalized, emailed: false, emailError: null };
  }
}
