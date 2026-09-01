// Shape a Stripe invoice for the UI.
export function mapInvoice(inv) {
  return {
    id: inv.id,
    number: inv.number,
    description: inv.description || inv.lines?.data?.[0]?.description || "Invoice",
    amountDue: inv.amount_due,
    amountPaid: inv.amount_paid,
    status: inv.status,
    created: inv.created,
    hostedInvoiceUrl: inv.hosted_invoice_url,
    invoicePdf: inv.invoice_pdf
  };
}
