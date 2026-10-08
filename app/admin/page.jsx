"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Plus, X, Send, CalendarClock, Copy, Check, ExternalLink, Trash2 } from "lucide-react";
import BrandMark from "../BrandMark";

function formatCents(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const INVOICE_KINDS = [
  { value: "SETUP_FEE", label: "Setup fee" },
  { value: "CUSTOM", label: "One-off" }
];
const KIND_TITLES = { SETUP_FEE: "Setup fee" };
const INVOICE_LABEL = { SCHEDULED: "Scheduled", SENT: "Sent", SENDING: "Sending", FAILED: "Failed", CANCELED: "Canceled" };
const INVOICE_TONE = { SCHEDULED: "amber", SENT: "green", SENDING: "blue", FAILED: "red", CANCELED: "grey" };
const SUB_TONE = { ACTIVE: "green", PAST_DUE: "amber", CANCELED: "red" };

function defaultLines(kind, client) {
  if (kind === "SETUP_FEE" && client.oneTimeAmountCents > 0) {
    return [{ description: "Setup fee", amountDollars: (client.oneTimeAmountCents / 100).toString() }];
  }
  return [{ description: "", amountDollars: "" }];
}

function initialInvoice(client) {
  return { kind: "SETUP_FEE", title: "", lines: defaultLines("SETUP_FEE", client), memo: "", daysUntilDue: "7", delivery: "now", sendAtLocal: "" };
}

// Earliest allowed value for a datetime-local input (local time).
function localInputMin() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function toCents(value) {
  return Math.round((parseFloat(value) || 0) * 100);
}

function formatDateTime(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
}

// ISO string to the local value expected by a datetime-local input.
function isoToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function Field({ label, hint, span, children }) {
  return (
    <label className={`adm-field${span ? " adm-span-2" : ""}`}>
      <span className="adm-label">{label}</span>
      {children}
      {hint && <span className="adm-hint">{hint}</span>}
    </label>
  );
}

const SETUP_TIMING_OPTIONS = [
  { value: "now", label: "Send invoice now" },
  { value: "schedule", label: "Schedule for a date" },
  { value: "none", label: "Don't create yet" }
];
const MONTHLY_TIMING_OPTIONS = [
  { value: "signup", label: "First charge when the client subscribes" },
  { value: "schedule", label: "First charge on a specific date" }
];

const EMPTY_CLIENT_FORM = {
  name: "",
  email: "",
  oneTimeAmountDollars: "",
  monthlyAmountDollars: "",
  setupMode: "now",
  setupSendAt: "",
  monthlyMode: "signup",
  monthlyStartAt: "",
  setupLines: [],
  setupMemo: ""
};

// Rows with a description and an amount above zero.
function completeSetupLines(lines) {
  return lines.filter((l) => l.description.trim() && parseFloat(l.amountDollars) > 0);
}

// Error message when a row has something filled in but is incomplete, otherwise "".
function setupLinesError(lines) {
  const filled = lines.filter((l) => l.description.trim() || String(l.amountDollars).trim());
  return filled.length === completeSetupLines(lines).length
    ? ""
    : "Each line item needs a description and an amount above zero. Remove any incomplete rows.";
}

// Timing select for a client invoice, plus a date picker when scheduling.
function Timing({ label, hint, options, mode, at, onMode, onAt }) {
  return (
    <>
      <Field label={label}>
        <select className="adm-input" value={mode} onChange={(e) => onMode(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      {mode === "schedule" && (
        <Field label="Date and time">
          <input className="adm-input" type="datetime-local" min={localInputMin()} required value={at} onChange={(e) => onAt(e.target.value)} />
        </Field>
      )}
      <span className="adm-hint">{hint}</span>
    </>
  );
}

// Returns an error message when a scheduled date is missing or not in the future.
function scheduleError(active, mode, at, what) {
  if (!active || mode !== "schedule") return "";
  if (!at) return `Choose a date and time to ${what}.`;
  if (new Date(at).getTime() <= Date.now()) return "The scheduled time must be in the future.";
  return "";
}

// One-line summary of a created client setup invoice.
function invoiceSummary(inv) {
  const label = "Setup invoice";
  if (inv.status === "SENT") return `${label}: sent`;
  if (inv.status === "FAILED") return `${label}: failed: ${inv.error || "unknown error"}`;
  if (inv.status === "SENDING") return `${label}: sending`;
  return `${label}: scheduled for ${formatDateTime(inv.sendAt)}`;
}

function lineItemsTotalCents(lines) {
  return completeSetupLines(lines).reduce((sum, l) => sum + toCents(l.amountDollars), 0);
}

// Error for the line-item editor: needs at least one complete row and no half-filled rows.
function lineItemsProblem(lines) {
  if (completeSetupLines(lines).length === 0) {
    return "Add at least one line item with a description and an amount above zero.";
  }
  return setupLinesError(lines);
}

// Saved invoice line items (cents) to editor rows (dollar strings).
function breakdownToLines(lineItems) {
  if (!lineItems || lineItems.length === 0) return [{ description: "", amountDollars: "" }];
  return lineItems.map((l) => ({ description: l.description || "", amountDollars: (l.amountCents / 100).toString() }));
}

// Shared line-item editor: rows, add/remove, live total and notes.
// Used by the Add a client form, the Details setup invoice and invoice history.
function LineItemsEditor({ lines, onChange, memo, onMemoChange, memoHint, memoPlaceholder }) {
  const setLine = (index, field, value) =>
    onChange(lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  const removeLine = (index) => onChange(lines.filter((_, i) => i !== index));
  const addLine = () => onChange([...lines, { description: "", amountDollars: "" }]);

  return (
    <>
      <table className="adm-lines">
        <thead>
          <tr>
            <th>Description</th>
            <th className="adm-right">Amount (USD)</th>
            <th aria-label="Remove"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td>
                <input className="adm-input adm-input-plain" value={line.description} onChange={(e) => setLine(i, "description", e.target.value)} placeholder="Description" />
              </td>
              <td>
                <div className="adm-money">
                  <span>$</span>
                  <input className="adm-input adm-input-plain" type="number" min="0" step="0.01" value={line.amountDollars} onChange={(e) => setLine(i, "amountDollars", e.target.value)} placeholder="0.00" />
                </div>
              </td>
              <td className="adm-right">
                <button type="button" className="adm-icon-btn" aria-label="Remove line item" onClick={() => removeLine(i)}>
                  <X size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="adm-lines-foot">
        <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={addLine}>
          <Plus size={14} /> Add line item
        </button>
      </div>
      <div className="adm-totals">
        <div className="adm-totals-note" />
        <div className="adm-total">
          <span>Total</span>
          <strong>{formatCents(lineItemsTotalCents(lines))}</strong>
        </div>
      </div>
      <Field label="Notes (optional)" hint={memoHint}>
        <textarea className="adm-input adm-textarea" rows={3} value={memo} onChange={(e) => onMemoChange(e.target.value)} placeholder={memoPlaceholder} />
      </Field>
    </>
  );
}

// Editor for an existing invoice's breakdown and notes. Calls onSubmit({ lineItems, memo }).
function InvoiceBreakdownEditor({ invoice, saving, submitLabel, onSubmit, onCancel }) {
  const [lines, setLines] = useState(() => breakdownToLines(invoice.lineItems));
  const [memo, setMemo] = useState(invoice.memo || "");
  const [problem, setProblem] = useState("");

  const submit = () => {
    const p = lineItemsProblem(lines);
    if (p) {
      setProblem(p);
      return;
    }
    setProblem("");
    onSubmit({
      lineItems: completeSetupLines(lines).map((l) => ({ description: l.description.trim(), amountDollars: Number(l.amountDollars) })),
      memo: memo.trim()
    });
  };

  return (
    <div className="adm-editor">
      <LineItemsEditor
        lines={lines}
        onChange={setLines}
        memo={memo}
        onMemoChange={setMemo}
        memoHint="Printed on the invoice."
      />
      {problem && <p className="adm-alert-error adm-inline">{problem}</p>}
      <div className="adm-actions">
        <button type="button" className="adm-btn adm-btn-outline adm-btn-sm" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" onClick={submit} disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>
    </div>
  );
}

// Newest setup invoice that is still live (ignores canceled ones). The list is newest first.
const SETUP_LIVE_STATUSES = ["SCHEDULED", "SENDING", "SENT", "FAILED"];
function findSetupInvoice(invoices) {
  return invoices.find((i) => i.kind === "SETUP_FEE" && SETUP_LIVE_STATUSES.includes(i.status)) || null;
}

function setupStatusPill(inv, paid) {
  if (paid) return { tone: "green", label: "Paid" };
  if (inv.status === "SCHEDULED") return { tone: "amber", label: `Scheduled for ${formatDateTime(inv.sendAt)}` };
  if (inv.status === "SENT") return { tone: "green", label: "Sent" };
  if (inv.status === "FAILED") return { tone: "red", label: "Failed" };
  return { tone: INVOICE_TONE[inv.status] || "blue", label: INVOICE_LABEL[inv.status] || inv.status };
}

export default function AdminPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_CLIENT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [itemizeOpen, setItemizeOpen] = useState(false);

  // When at least one complete line item exists, the setup fee is their sum.
  const itemsComplete = completeSetupLines(form.setupLines);
  const itemizing = itemsComplete.length > 0;
  const itemsTotalCents = itemsComplete.reduce((sum, l) => sum + toCents(l.amountDollars), 0);
  const setupCents = itemizing ? itemsTotalCents : toCents(form.oneTimeAmountDollars);

  const toggleItemize = () => {
    if (!itemizeOpen) {
      // Opening prefills a "Setup fee" row from the plain amount, if one is entered.
      setForm((p) => {
        if (p.setupLines.length > 0) return p;
        const row = toCents(p.oneTimeAmountDollars) > 0
          ? { description: "Setup fee", amountDollars: p.oneTimeAmountDollars }
          : { description: "", amountDollars: "" };
        return { ...p, setupLines: [row] };
      });
    }
    setItemizeOpen(!itemizeOpen);
  };

  const loadClients = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/clients");
    const data = await res.json();
    setClients(data.clients || []);
    setLoading(false);
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setCreated(null);
    setCopied(false);

    const linesProblem = setupLinesError(form.setupLines);
    if (linesProblem) {
      setError(linesProblem);
      return;
    }

    const setupActive = setupCents > 0;
    const monthlyActive = toCents(form.monthlyAmountDollars) > 0;

    const timingProblem =
      scheduleError(setupActive, form.setupMode, form.setupSendAt, "send the setup invoice")
      || scheduleError(monthlyActive, form.monthlyMode, form.monthlyStartAt, "start the subscription");
    if (timingProblem) {
      setError(timingProblem);
      return;
    }

    const payload = {
      name: form.name,
      email: form.email,
      oneTimeAmountDollars: itemizing ? (itemsTotalCents / 100).toString() : form.oneTimeAmountDollars,
      monthlyAmountDollars: form.monthlyAmountDollars,
      setupMode: setupActive ? form.setupMode : "none",
      monthlyMode: monthlyActive ? form.monthlyMode : "signup",
      setupMemo: form.setupMemo.trim()
    };
    if (itemizing) {
      payload.setupLineItems = itemsComplete.map((l) => ({
        description: l.description.trim(),
        amountDollars: Number(l.amountDollars)
      }));
    }
    if (payload.setupMode === "schedule") {
      payload.setupSendAt = new Date(form.setupSendAt).toISOString();
    }
    if (monthlyActive && payload.monthlyMode === "schedule") {
      payload.monthlyStartAt = new Date(form.monthlyStartAt).toISOString();
    }

    setSubmitting(true);
    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    setCreated({
      email: data.client.email,
      tempPassword: data.tempPassword,
      invoices: data.invoices || {},
      monthly: monthlyActive,
      monthlyStartAt: payload.monthlyStartAt || null
    });
    setForm(EMPTY_CLIENT_FORM);
    setItemizeOpen(false);
    loadClients();
  };

  const copyCredentials = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${created.email}\nTemporary password: ${created.tempPassword}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="dash-shell">
      <div className="container">
        <div className="dash-header">
          <div>
            <BrandMark />
            <h1 style={{ marginTop: 18 }}>Admin: Clients</h1>
            <p className="adm-sub">{loading ? "Loading clients" : `${clients.length} ${clients.length === 1 ? "client" : "clients"}`}</p>
          </div>
          <button className="dash-signout" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
        </div>

        <form className="adm-card adm-create" onSubmit={handleSubmit}>
          <div className="adm-card-head">
            <h2 className="adm-card-title">Add a client</h2>
            <p className="adm-sub">Creates a login for the client and sets their pricing.</p>
          </div>
          <div className="adm-grid-2">
            <Field label="Name"><input className="adm-input" required value={form.name} onChange={handleChange("name")} placeholder="Client business name" /></Field>
            <Field label="Email"><input className="adm-input" required type="email" value={form.email} onChange={handleChange("email")} placeholder="client@company.com" /></Field>
            <div className="adm-timing">
              <Field label="Setup fee (USD)" hint={itemizing ? "Total of the line items." : undefined}>
                <input
                  className="adm-input"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemizing ? (itemsTotalCents / 100).toFixed(2) : form.oneTimeAmountDollars}
                  onChange={handleChange("oneTimeAmountDollars")}
                  placeholder="2500"
                  disabled={itemizing}
                />
              </Field>
              <div>
                <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={toggleItemize} aria-expanded={itemizeOpen}>
                  {itemizeOpen ? "Hide itemize / notes" : "Itemize / add notes"}
                </button>
              </div>
              {itemizeOpen && (
                <LineItemsEditor
                  lines={form.setupLines}
                  onChange={(setupLines) => setForm((p) => ({ ...p, setupLines }))}
                  memo={form.setupMemo}
                  onMemoChange={(setupMemo) => setForm((p) => ({ ...p, setupMemo }))}
                  memoHint="Printed on the setup invoice."
                  memoPlaceholder="Initial build $200, domain $15 ..."
                />
              )}
              {setupCents > 0 && (
                <Timing
                  label="Setup invoice"
                  hint="Emailed as an invoice on the date you choose."
                  options={SETUP_TIMING_OPTIONS}
                  mode={form.setupMode}
                  at={form.setupSendAt}
                  onMode={(setupMode) => setForm((p) => ({ ...p, setupMode }))}
                  onAt={(setupSendAt) => setForm((p) => ({ ...p, setupSendAt }))}
                />
              )}
            </div>
            <div className="adm-timing">
              <Field label="Monthly subscription (USD)">
                <input className="adm-input" required type="number" min="0" step="0.01" value={form.monthlyAmountDollars} onChange={handleChange("monthlyAmountDollars")} placeholder="150" />
              </Field>
              {toCents(form.monthlyAmountDollars) > 0 && (
                <Timing
                  label="Monthly billing"
                  hint="No email is sent. Tell the client to open their account page and press Subscribe monthly; their card is then charged automatically every month and they get a receipt."
                  options={MONTHLY_TIMING_OPTIONS}
                  mode={form.monthlyMode}
                  at={form.monthlyStartAt}
                  onMode={(monthlyMode) => setForm((p) => ({ ...p, monthlyMode }))}
                  onAt={(monthlyStartAt) => setForm((p) => ({ ...p, monthlyStartAt }))}
                />
              )}
            </div>
          </div>

          {error && <p className="adm-alert-error">{error}</p>}

          <div className="adm-actions">
            <button className="adm-btn adm-btn-primary" type="submit" disabled={submitting}>
              <Plus size={15} /> {submitting ? "Creating..." : "Create client"}
            </button>
          </div>

          {created && (
            <div className="adm-callout" role="status">
              <div className="adm-callout-text">
                <strong>Client created.</strong> Share these login details with the client.
                <dl className="adm-creds">
                  <dt>Email</dt><dd>{created.email}</dd>
                  <dt>Temporary password</dt><dd>{created.tempPassword}</dd>
                </dl>
                {created.invoices?.setup && <p className="adm-creds-line">{invoiceSummary(created.invoices.setup)}</p>}
                {created.monthly && (
                  <p className="adm-creds-line">
                    Monthly: client subscribes from their account page
                    {created.monthlyStartAt && ` — first charge ${formatDateTime(created.monthlyStartAt)}`}
                  </p>
                )}
              </div>
              <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={copyCredentials}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy details"}
              </button>
            </div>
          )}
        </form>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Setup fee</th>
                <th>Monthly</th>
                <th>Subscription</th>
                <th>Account</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="adm-empty">Loading…</td></tr>}
              {!loading && clients.length === 0 && <tr><td colSpan={6} className="adm-empty">No clients yet.</td></tr>}
              {clients.map((client) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  open={openId === client.id}
                  onToggle={() => setOpenId(openId === client.id ? null : client.id)}
                  onChanged={loadClients}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ClientRow({ client, open, onToggle, onChanged }) {
  const [edit, setEdit] = useState({
    name: client.name,
    email: client.email,
    oneTimeAmountDollars: (client.oneTimeAmountCents / 100).toString(),
    monthlyAmountDollars: (client.monthlyAmountCents / 100).toString(),
    monthlyStartAt: isoToLocalInput(client.monthlyStartAt)
  });
  const [invoice, setInvoice] = useState(() => initialInvoice(client));
  const [invoices, setInvoices] = useState([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  // Which breakdown editor is open: { id, where: "details" | "history" }.
  const [editing, setEditing] = useState(null);

  const call = async (label, url, options) => {
    setBusy(label);
    setMsg("");
    setErr("");
    try {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Request failed.");
        return null;
      }
      return data;
    } finally {
      setBusy("");
    }
  };

  const loadInvoices = async () => {
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/invoices`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setInvoices(data.invoices || []);
      else setErr(data.error || "Could not load invoices.");
    } catch {
      setErr("Could not load invoices.");
    }
  };

  useEffect(() => {
    if (open) loadInvoices();
  }, [open]);

  const setupInv = findSetupInvoice(invoices);

  const saveEdit = async () => {
    const { monthlyStartAt, oneTimeAmountDollars, ...details } = edit;
    const body = { ...details };
    // With a setup invoice, its line items set the amount, so the plain amount is not sent.
    if (!setupInv) body.oneTimeAmountDollars = oneTimeAmountDollars;
    // Once subscribed, the first-charge date can no longer be changed.
    if (client.subscriptionStatus !== "ACTIVE") {
      body.monthlyStartAt = monthlyStartAt ? new Date(monthlyStartAt).toISOString() : null;
    }
    const data = await call("edit", `/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (data) {
      setMsg("Saved.");
      await loadInvoices();
      onChanged();
    }
  };

  // Saves a new breakdown for an unpaid invoice. A SENT invoice is voided and replaced by the API.
  const saveBreakdown = async (inv, payload) => {
    const sent = inv.status === "SENT";
    if (sent && !window.confirm("This voids the invoice already sent to the client and emails them a corrected one.")) {
      return;
    }
    const body = { ...payload };
    // Scheduled or failed invoices keep their send date; a sent one is re-sent now.
    if (sent) body.sendAt = null;
    const data = await call(`edit-${inv.id}`, `/api/admin/clients/${client.id}/invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!data) return;
    setEditing(null);
    if (data.replaced) setMsg("Old invoice voided and a corrected invoice was sent.");
    else setMsg(inv.kind === "SETUP_FEE" ? "Setup invoice updated." : "Invoice updated.");
    await loadInvoices();
    onChanged();
  };

  const voidInvoice = async (inv) => {
    if (!window.confirm("Void this invoice? The payment link will stop working.")) return;
    const data = await call(`void-${inv.id}`, `/api/admin/clients/${client.id}/invoices/${inv.id}`, { method: "DELETE" });
    if (data) {
      setEditing(null);
      setMsg("Invoice voided.");
      await loadInvoices();
      onChanged();
    }
  };

  const resetPassword = async () => {
    const data = await call("reset", `/api/admin/clients/${client.id}/reset-password`, { method: "POST" });
    if (data) setMsg(`New temporary password: ${data.tempPassword}`);
  };

  const toggleActive = async () => {
    const data = await call("active", `/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !client.isActive })
    });
    if (data) {
      setMsg(data.isActive ? "Account activated." : "Account deactivated.");
      onChanged();
    }
  };

  const cancelSub = async () => {
    const data = await call("cancelsub", `/api/admin/clients/${client.id}/subscription`, { method: "DELETE" });
    if (data) {
      setMsg("Subscription canceled.");
      onChanged();
    }
  };

  const deleteClient = async () => {
    if (!window.confirm(`Permanently delete ${client.name}? The login is removed, unpaid invoices are voided so their payment links stop working, and paid invoice history and receipts are kept in Stripe.`)) {
      return;
    }
    const data = await call("delete", `/api/admin/clients/${client.id}`, { method: "DELETE" });
    if (data) onChanged();
  };

  const changeKind = (kind) => {
    setInvoice((p) => ({ ...p, kind, lines: defaultLines(kind, client) }));
  };

  const setLine = (index, field, value) => {
    setInvoice((p) => ({
      ...p,
      lines: p.lines.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    }));
  };

  const removeLine = (index) => {
    setInvoice((p) => ({ ...p, lines: p.lines.filter((_, i) => i !== index) }));
  };

  const addLine = () => {
    setInvoice((p) => ({ ...p, lines: [...p.lines, { description: "", amountDollars: "" }] }));
  };

  const invField = (field) => (e) => setInvoice((p) => ({ ...p, [field]: e.target.value }));

  const submitInvoice = async () => {
    const filled = invoice.lines.filter((l) => l.description.trim() || l.amountDollars.toString().trim());
    const valid = filled.filter((l) => l.description.trim() && parseFloat(l.amountDollars) > 0);
    if (valid.length === 0) {
      setMsg("");
      setErr("Add at least one line item with a description and an amount above zero.");
      return;
    }
    if (valid.length !== filled.length) {
      setMsg("");
      setErr("Each line item needs a description and an amount above zero. Remove any incomplete rows.");
      return;
    }

    const days = Number(invoice.daysUntilDue);
    if (!Number.isInteger(days) || days < 1) {
      setMsg("");
      setErr("Payment due must be a whole number of days, at least 1.");
      return;
    }

    let sendAt = null;
    if (invoice.delivery === "later") {
      const when = new Date(invoice.sendAtLocal);
      if (!invoice.sendAtLocal || Number.isNaN(when.getTime())) {
        setMsg("");
        setErr("Choose a date and time to schedule the invoice.");
        return;
      }
      if (when.getTime() <= Date.now()) {
        setMsg("");
        setErr("The scheduled time must be in the future.");
        return;
      }
      sendAt = when.toISOString();
    }

    const title = invoice.kind === "CUSTOM"
      ? invoice.title.trim() || valid[0].description.trim()
      : KIND_TITLES[invoice.kind];

    const data = await call("invoice", `/api/admin/clients/${client.id}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: invoice.kind,
        title,
        lineItems: valid.map((l) => ({ description: l.description.trim(), amountDollars: Number(l.amountDollars) })),
        sendAt,
        daysUntilDue: days,
        memo: invoice.memo.trim()
      })
    });
    if (data) {
      setInvoice(initialInvoice(client));
      await loadInvoices();
      setMsg(sendAt ? `Invoice scheduled for ${formatDateTime(sendAt)}.` : "Invoice sent to the client's email.");
    }
  };

  const cancelInvoice = async (inv) => {
    if (!window.confirm(`Cancel "${inv.title}"? It will not be sent.`)) return;
    const data = await call(`cancel-${inv.id}`, `/api/admin/clients/${client.id}/invoices/${inv.id}`, { method: "DELETE" });
    if (data) {
      setMsg("Invoice canceled.");
      await loadInvoices();
    }
  };

  const editField = (field) => (e) => setEdit((p) => ({ ...p, [field]: e.target.value }));

  const totalCents = invoice.lines.reduce((sum, l) => sum + toCents(l.amountDollars), 0);
  const kindLabel = INVOICE_KINDS.find((k) => k.value === invoice.kind)?.label || "";
  const submitLabel = invoice.delivery === "later" ? "Schedule invoice" : "Send invoice now";
  const subActive = client.subscriptionStatus === "ACTIVE";

  return (
    <>
      <tr className="adm-row">
        <td>
          <div className="adm-client-name">{client.name}</div>
          <div className="adm-client-email">{client.email}</div>
        </td>
        <td>
          {formatCents(client.oneTimeAmountCents)}
          {client.oneTimePaidAt && <span className="adm-paid">paid</span>}
        </td>
        <td>
          {formatCents(client.monthlyAmountCents)}<span className="adm-muted">/mo</span>
          {client.monthlyStartAt && client.subscriptionStatus !== "ACTIVE" && (
            <span className="adm-when">first charge {formatDateTime(client.monthlyStartAt)}</span>
          )}
        </td>
        <td><span className={`adm-pill adm-pill-${SUB_TONE[client.subscriptionStatus] || "grey"}`}>{client.subscriptionStatus}</span></td>
        <td><span className={`adm-pill adm-pill-${client.isActive ? "green" : "grey"}`}>{client.isActive ? "Active" : "Deactivated"}</span></td>
        <td className="adm-right">
          <button className="adm-btn adm-btn-outline adm-btn-sm" onClick={onToggle} aria-expanded={open}>{open ? "Close" : "Manage"}</button>
        </td>
      </tr>
      {open && (
        <tr className="adm-expand">
          <td colSpan={6}>
            <div className="adm-manage">
              {msg && <p className="adm-alert-ok">{msg}</p>}
              {err && <p className="adm-alert-error">{err}</p>}

              <section className="adm-card">
                <h3 className="adm-card-title">Details</h3>
                <div className="adm-stack">
                  <Field label="Name"><input className="adm-input" value={edit.name} onChange={editField("name")} /></Field>
                  <Field label="Email"><input className="adm-input" type="email" value={edit.email} onChange={editField("email")} /></Field>
                  {setupInv ? (
                    <div className="adm-setup-inv">
                      <div className="adm-setup-head">
                        <span className="adm-label">Setup invoice</span>
                        <span className={`adm-pill adm-pill-${setupStatusPill(setupInv, client.oneTimePaidAt).tone}`}>
                          {setupStatusPill(setupInv, client.oneTimePaidAt).label}
                        </span>
                      </div>
                      {setupInv.status === "FAILED" && setupInv.error && <p className="adm-alert-error adm-inline">{setupInv.error}</p>}

                      {editing?.where === "details" && editing.id === setupInv.id ? (
                        <InvoiceBreakdownEditor
                          invoice={setupInv}
                          saving={busy === `edit-${setupInv.id}`}
                          submitLabel={setupInv.status === "SENT" ? "Void & send updated invoice" : "Save changes"}
                          onSubmit={(payload) => saveBreakdown(setupInv, payload)}
                          onCancel={() => setEditing(null)}
                        />
                      ) : (
                        <>
                          <table className="adm-lines adm-lines-ro">
                            <tbody>
                              {setupInv.lineItems.map((l, i) => (
                                <tr key={i}>
                                  <td>{l.description}</td>
                                  <td className="adm-right">{formatCents(l.amountCents)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {setupInv.memo && (
                            <div className="adm-setup-notes">
                              <span className="adm-label">Notes</span>
                              <p>{setupInv.memo}</p>
                            </div>
                          )}
                          <div className="adm-setup-foot">
                            <div className="adm-total">
                              <span>Total</span>
                              <strong>{formatCents(setupInv.totalCents)}</strong>
                            </div>
                            {client.oneTimePaidAt ? (
                              <span className="adm-muted">Paid, locked</span>
                            ) : (
                              setupInv.status !== "SENDING" && (
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-ghost adm-btn-sm"
                                  onClick={() => setEditing({ id: setupInv.id, where: "details" })}
                                >
                                  Edit breakdown
                                </button>
                              )
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <Field label="Setup fee (USD)" hint={client.oneTimePaidAt ? "Paid, locked" : "No setup invoice yet. Create one in the Invoices card below."}>
                      <input
                        className="adm-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={edit.oneTimeAmountDollars}
                        onChange={editField("oneTimeAmountDollars")}
                        disabled={Boolean(client.oneTimePaidAt)}
                      />
                    </Field>
                  )}
                  <Field label="Monthly (USD)">
                    <input className="adm-input" type="number" min="0" step="0.01" value={edit.monthlyAmountDollars} onChange={editField("monthlyAmountDollars")} />
                  </Field>
                  <Field
                    label="First monthly charge"
                    hint={subActive ? "Subscription already active" : "Leave empty to charge when the client subscribes."}
                  >
                    <div className="adm-when-row">
                      <input
                        className="adm-input"
                        type="datetime-local"
                        min={localInputMin()}
                        value={edit.monthlyStartAt}
                        onChange={editField("monthlyStartAt")}
                        disabled={subActive}
                      />
                      {!subActive && edit.monthlyStartAt && (
                        <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setEdit((p) => ({ ...p, monthlyStartAt: "" }))}>
                          Clear
                        </button>
                      )}
                    </div>
                  </Field>
                </div>
                <div className="adm-actions">
                  <button className="adm-btn adm-btn-primary" onClick={saveEdit} disabled={busy === "edit"}>
                    {busy === "edit" ? "Saving..." : "Save details"}
                  </button>
                </div>
              </section>

              <section className="adm-card">
                <h3 className="adm-card-title">Account</h3>
                <div className="adm-action-list">
                  <button className="adm-btn adm-btn-outline" onClick={resetPassword} disabled={busy === "reset"}>
                    {busy === "reset" ? "Resetting..." : "Reset password"}
                  </button>
                  <button className="adm-btn adm-btn-outline" onClick={toggleActive} disabled={busy === "active"}>
                    {client.isActive ? "Deactivate account" : "Activate account"}
                  </button>
                  {client.subscriptionStatus === "ACTIVE" && (
                    <button className="adm-btn adm-btn-outline" onClick={cancelSub} disabled={busy === "cancelsub"}>
                      Cancel subscription
                    </button>
                  )}
                </div>
                <div className="adm-danger">
                  <div className="adm-danger-text">
                    <strong>Delete client</strong>
                    <span>Removes the login and account. Stripe invoice history is kept.</span>
                  </div>
                  <button className="adm-btn adm-btn-danger" onClick={deleteClient} disabled={busy === "delete"}>
                    <Trash2 size={14} /> {busy === "delete" ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </section>

              <section className="adm-card adm-span-2">
                <h3 className="adm-card-title">Invoices</h3>

                <div className="adm-doc">
                  <div className="adm-doc-head">
                    <div>
                      <div className="adm-doc-title">Invoice</div>
                      <div className="adm-doc-to">
                        <strong>{client.name}</strong>
                        <span>{client.email}</span>
                      </div>
                    </div>
                    <div className="adm-seg" role="group" aria-label="Invoice type">
                      {INVOICE_KINDS.map((k) => (
                        <button
                          key={k.value}
                          type="button"
                          aria-pressed={invoice.kind === k.value}
                          className={`adm-seg-btn${invoice.kind === k.value ? " is-on" : ""}`}
                          onClick={() => changeKind(k.value)}
                        >
                          {k.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {invoice.kind === "CUSTOM" && (
                    <Field label="Invoice title" hint="Shown on the invoice. Defaults to the first line item.">
                      <input className="adm-input" value={invoice.title} onChange={invField("title")} placeholder="e.g. Website add-ons" />
                    </Field>
                  )}

                  <table className="adm-lines">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th className="adm-right">Amount (USD)</th>
                        <th aria-label="Remove"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.lines.map((line, i) => (
                        <tr key={i}>
                          <td>
                            <input className="adm-input adm-input-plain" value={line.description} onChange={(e) => setLine(i, "description", e.target.value)} placeholder="Description" />
                          </td>
                          <td>
                            <div className="adm-money">
                              <span>$</span>
                              <input className="adm-input adm-input-plain" type="number" min="0" step="0.01" value={line.amountDollars} onChange={(e) => setLine(i, "amountDollars", e.target.value)} placeholder="0.00" />
                            </div>
                          </td>
                          <td className="adm-right">
                            <button type="button" className="adm-icon-btn" aria-label="Remove line item" onClick={() => removeLine(i)}>
                              <X size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="adm-lines-foot">
                    <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={addLine}>
                      <Plus size={14} /> Add line item
                    </button>
                  </div>

                  <div className="adm-totals">
                    <div className="adm-totals-note" />
                    <div className="adm-total">
                      <span>Total</span>
                      <strong>{formatCents(totalCents)}</strong>
                    </div>
                  </div>

                  <div className="adm-doc-grid">
                    <Field label="Notes (optional)">
                      <textarea className="adm-input adm-textarea" rows={3} value={invoice.memo} onChange={invField("memo")} placeholder="Shown on the invoice" />
                    </Field>
                    <Field label="Payment due within (days)">
                      <input className="adm-input" type="number" min="1" step="1" value={invoice.daysUntilDue} onChange={invField("daysUntilDue")} />
                    </Field>
                  </div>

                  <div className="adm-delivery">
                    <span className="adm-label">Delivery</span>
                    <div className="adm-seg" role="group" aria-label="Delivery">
                      <button type="button" aria-pressed={invoice.delivery === "now"} className={`adm-seg-btn${invoice.delivery === "now" ? " is-on" : ""}`} onClick={() => setInvoice((p) => ({ ...p, delivery: "now" }))}>
                        Send now
                      </button>
                      <button type="button" aria-pressed={invoice.delivery === "later"} className={`adm-seg-btn${invoice.delivery === "later" ? " is-on" : ""}`} onClick={() => setInvoice((p) => ({ ...p, delivery: "later" }))}>
                        Schedule
                      </button>
                    </div>
                    {invoice.delivery === "later" && (
                      <Field label="Send on" hint="Sends automatically on that date.">
                        <input className="adm-input" type="datetime-local" min={localInputMin()} value={invoice.sendAtLocal} onChange={invField("sendAtLocal")} />
                      </Field>
                    )}
                  </div>

                  <div className="adm-actions">
                    <span className="adm-muted adm-kind-note">{kindLabel} · due in {invoice.daysUntilDue || "–"} days</span>
                    <button className="adm-btn adm-btn-primary" type="button" onClick={submitInvoice} disabled={busy === "invoice"}>
                      {invoice.delivery === "later" ? <CalendarClock size={15} /> : <Send size={15} />}
                      {busy === "invoice" ? "Working..." : submitLabel}
                    </button>
                  </div>
                </div>

                <div className="adm-history">
                  <h4 className="adm-subtitle">History</h4>
                  {invoices.length === 0 && <p className="adm-empty adm-empty-left">No invoices yet.</p>}
                  <ul className="adm-timeline">
                    {invoices.map((inv) => {
                      const when = inv.status === "SENT" && inv.sentAt
                        ? `Sent ${formatDateTime(inv.sentAt)}`
                        : `Scheduled for ${formatDateTime(inv.sendAt)}`;
                      const cancelable = inv.status === "SCHEDULED" || inv.status === "FAILED";
                      const editable = cancelable;
                      const isEditing = editing?.where === "history" && editing.id === inv.id;
                      return (
                        <li key={inv.id} className="adm-tl-item">
                          <div className="adm-tl-main">
                            <div className="adm-tl-title">
                              <span>{inv.title}</span>
                              <span className={`adm-pill adm-pill-${INVOICE_TONE[inv.status] || "grey"}`}>{INVOICE_LABEL[inv.status] || inv.status}</span>
                            </div>
                            <div className="adm-tl-meta">{formatCents(inv.totalCents)} · {when}</div>
                            {inv.status === "FAILED" && inv.error && <p className="adm-alert-error adm-inline">{inv.error}</p>}
                            {inv.status === "CANCELED" && inv.error && <p className="adm-muted adm-inline">{inv.error}</p>}
                          </div>
                          <div className="adm-tl-actions">
                            {inv.hostedInvoiceUrl && (
                              <a className="adm-link" href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                                View <ExternalLink size={13} />
                              </a>
                            )}
                            {!isEditing && editable && (
                              <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setEditing({ id: inv.id, where: "history" })}>
                                Edit
                              </button>
                            )}
                            {!isEditing && cancelable && (
                              <button className="adm-btn adm-btn-outline adm-btn-sm" onClick={() => cancelInvoice(inv)} disabled={busy === `cancel-${inv.id}`}>
                                {busy === `cancel-${inv.id}` ? "Canceling..." : "Cancel"}
                              </button>
                            )}
                            {inv.status === "SENT" && (
                              <button className="adm-btn adm-btn-outline adm-btn-sm" onClick={() => voidInvoice(inv)} disabled={busy === `void-${inv.id}`}>
                                {busy === `void-${inv.id}` ? "Voiding..." : "Void"}
                              </button>
                            )}
                          </div>
                          {isEditing && (
                            <InvoiceBreakdownEditor
                              invoice={inv}
                              saving={busy === `edit-${inv.id}`}
                              submitLabel="Save changes"
                              onSubmit={(payload) => saveBreakdown(inv, payload)}
                              onCancel={() => setEditing(null)}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
