// Transactional email through Resend (https://resend.com/docs/api-reference/emails/send-email).

const NAVY = "#161a5a";
const INK = "#1f2433";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail({ to, subject, html, text }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      html,
      text
    })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Resend request failed with status ${res.status}`);
  }

  return res.json().catch(() => ({}));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Escape text and keep its line breaks.
function multiline(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatUsd(cents) {
  return usd.format((Number(cents) || 0) / 100);
}

function greeting(name) {
  const first = String(name ?? "").trim();
  return first ? `Hi ${first},` : "Hi,";
}

function shell({ preheader, body }) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f9;font-family:Helvetica,Arial,sans-serif;color:${INK};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f9;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;border:1px solid ${BORDER};">
      <tr><td style="background:${NAVY};border-radius:8px 8px 0 0;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold;">Kedros</td></tr>
      <tr><td style="padding:28px;font-size:15px;line-height:1.55;">
        ${body}
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">
        Kedros &middot; Questions about this email? Reply to it and we will help.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function button(url, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td style="background:${NAVY};border-radius:6px;">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

export function invoiceEmail({ name, title, lineItems = [], totalCents, dueDays, memo, payUrl }) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  const total = Number.isFinite(totalCents)
    ? totalCents
    : items.reduce((sum, li) => sum + (Number(li.amountCents) || 0), 0);
  const invoiceTitle = String(title ?? "").trim() || "Invoice";
  const days = Number(dueDays);
  const dueText =
    Number.isFinite(days) && days > 0 ? `Due in ${days} ${days === 1 ? "day" : "days"}.` : "";

  const rows = items
    .map(
      (li) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${BORDER};">${escapeHtml(li.description)}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid ${BORDER};white-space:nowrap;">${formatUsd(li.amountCents)}</td>
      </tr>`
    )
    .join("");

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;color:${NAVY};">Invoice from Kedros</h1>
    <p style="margin:0 0 20px;color:${MUTED};">${escapeHtml(invoiceTitle)}</p>
    <p style="margin:0 0 20px;">${escapeHtml(greeting(name))} your invoice is ready. ${escapeHtml(dueText)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
      ${rows}
      <tr>
        <td style="padding:14px 0 0;font-weight:bold;">Total due</td>
        <td align="right" style="padding:14px 0 0;font-weight:bold;color:${NAVY};white-space:nowrap;">${formatUsd(total)}</td>
      </tr>
    </table>
    ${payUrl ? button(payUrl, "Pay invoice") : ""}
    ${memo ? `<p style="margin:0 0 8px;padding:12px 14px;background:#f4f5f9;border-radius:6px;color:${INK};"><strong>Note:</strong> ${multiline(memo)}</p>` : ""}
    <p style="margin:16px 0 0;color:${MUTED};font-size:13px;">Payment is processed securely by Stripe.</p>`;

  const lines = [
    "Invoice from Kedros",
    invoiceTitle,
    "",
    greeting(name),
    `Your invoice is ready. ${dueText}`.trim(),
    "",
    ...items.map((li) => `${li.description}: ${formatUsd(li.amountCents)}`),
    `Total due: ${formatUsd(total)}`,
    "",
    payUrl ? `Pay invoice: ${payUrl}` : "",
    memo ? `\nNote: ${memo}` : ""
  ];

  return {
    subject: `Invoice from Kedros: ${invoiceTitle}`,
    html: shell({ preheader: `${invoiceTitle} - ${formatUsd(total)}`, body }),
    text: lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n")
  };
}

export function receiptEmail({ name, amountCents, description, paidAt, invoiceUrl, pdfUrl }) {
  const when = paidAt instanceof Date && !Number.isNaN(paidAt.getTime()) ? paidAt : new Date();
  const dateText = when.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  });
  const label = String(description ?? "").trim() || "Monthly subscription";
  const amount = formatUsd(amountCents);

  const links = [];
  if (invoiceUrl) links.push(button(invoiceUrl, "View receipt"));
  if (pdfUrl) {
    links.push(`<p style="margin:0 0 16px;"><a href="${escapeHtml(pdfUrl)}" style="color:${NAVY};font-weight:bold;">Download PDF</a></p>`);
  }

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;color:${NAVY};">Payment received</h1>
    <p style="margin:0 0 20px;">${escapeHtml(greeting(name))} thank you, we received your payment.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid ${BORDER};color:${MUTED};">Description</td>
        <td align="right" style="padding:8px 0;border-bottom:1px solid ${BORDER};">${escapeHtml(label)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid ${BORDER};color:${MUTED};">Date</td>
        <td align="right" style="padding:8px 0;border-bottom:1px solid ${BORDER};">${escapeHtml(dateText)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:bold;">Amount paid</td>
        <td align="right" style="padding:8px 0;font-weight:bold;color:${NAVY};">${amount}</td>
      </tr>
    </table>
    <p style="margin:20px 0 0;">This payment was charged automatically to the card on file for your account.</p>
    ${links.join("\n")}`;

  const lines = [
    "Payment received",
    "",
    greeting(name),
    "Thank you, we received your payment.",
    "",
    `Description: ${label}`,
    `Date: ${dateText}`,
    `Amount paid: ${amount}`,
    "",
    "This payment was charged automatically to the card on file for your account.",
    invoiceUrl ? `View receipt: ${invoiceUrl}` : "",
    pdfUrl ? `Download PDF: ${pdfUrl}` : ""
  ].filter((l, i, arr) => !(l === "" && arr[i - 1] === ""));

  return {
    subject: `Payment received: ${amount} for ${label}`,
    html: shell({ preheader: `Payment of ${amount} received`, body }),
    text: lines.join("\n")
  };
}
