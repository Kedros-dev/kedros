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
  { value: "MONTHLY", label: "Monthly" },
  { value: "CUSTOM", label: "One-off" }
];
const KIND_TITLES = { SETUP_FEE: "Setup fee", MONTHLY: "Monthly subscription" };
const INVOICE_LABEL = { SCHEDULED: "Scheduled", SENT: "Sent", SENDING: "Sending", FAILED: "Failed", CANCELED: "Canceled" };
const INVOICE_TONE = { SCHEDULED: "amber", SENT: "green", SENDING: "blue", FAILED: "red", CANCELED: "grey" };
const SUB_TONE = { ACTIVE: "green", PAST_DUE: "amber", CANCELED: "red" };

function defaultLines(kind, client) {
  if (kind === "SETUP_FEE" && client.oneTimeAmountCents > 0) {
    return [{ description: "Setup fee", amountDollars: (client.oneTimeAmountCents / 100).toString() }];
  }
  if (kind === "MONTHLY" && client.monthlyAmountCents > 0) {
    return [{ description: "Monthly subscription", amountDollars: (client.monthlyAmountCents / 100).toString() }];
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
  { value: "now", label: "Start subscription now" },
  { value: "schedule", label: "Start on a date" },
  { value: "none", label: "Don't start yet" }
];

const EMPTY_CLIENT_FORM = {
  name: "",
  email: "",
  oneTimeAmountDollars: "",
  monthlyAmountDollars: "",
  setupMode: "now",
  setupSendAt: "",
  monthlyMode: "now",
  monthlyStartAt: ""
};

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

// One-line summary of a created client invoice or subscription.
function invoiceSummary(inv, monthly) {
  const label = monthly ? "Subscription" : "Setup invoice";
  if (inv.status === "SENT") return `${label}: ${monthly ? "started" : "sent"}`;
  if (inv.status === "FAILED") return `${label}: failed: ${inv.error || "unknown error"}`;
  if (inv.status === "SENDING") return `${label}: sending`;
  return `${label}: scheduled for ${formatDateTime(inv.sendAt)}`;
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

    const setupActive = toCents(form.oneTimeAmountDollars) > 0;
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
      oneTimeAmountDollars: form.oneTimeAmountDollars,
      monthlyAmountDollars: form.monthlyAmountDollars,
      setupMode: setupActive ? form.setupMode : "none",
      monthlyMode: monthlyActive ? form.monthlyMode : "none"
    };
    if (payload.setupMode === "schedule") {
      payload.setupSendAt = new Date(form.setupSendAt).toISOString();
    }
    if (payload.monthlyMode === "schedule") {
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

    setCreated({ email: data.client.email, tempPassword: data.tempPassword, invoices: data.invoices || {} });
    setForm(EMPTY_CLIENT_FORM);
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
              <Field label="Setup fee (USD)">
                <input className="adm-input" required type="number" min="0" step="0.01" value={form.oneTimeAmountDollars} onChange={handleChange("oneTimeAmountDollars")} placeholder="2500" />
              </Field>
              {toCents(form.oneTimeAmountDollars) > 0 && (
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
                  label="Subscription start"
                  hint="The subscription starts on the date you choose; Stripe then emails an invoice every month."
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
                {created.invoices?.setup && <p className="adm-creds-line">{invoiceSummary(created.invoices.setup, false)}</p>}
                {created.invoices?.monthly && <p className="adm-creds-line">{invoiceSummary(created.invoices.monthly, true)}</p>}
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
    monthlyAmountDollars: (client.monthlyAmountCents / 100).toString()
  });
  const [invoice, setInvoice] = useState(() => initialInvoice(client));
  const [invoices, setInvoices] = useState([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

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

  const saveEdit = async () => {
    const data = await call("edit", `/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit)
    });
    if (data) {
      setMsg("Saved.");
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
    if (!window.confirm(`Permanently delete ${client.name}? Their Stripe invoice history is kept, but the login and account are removed.`)) {
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
        <td>{formatCents(client.monthlyAmountCents)}<span className="adm-muted">/mo</span></td>
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
                  <Field label="Setup fee (USD)" hint={client.oneTimePaidAt ? "Paid, locked" : undefined}>
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
                  <Field label="Monthly (USD)">
                    <input className="adm-input" type="number" min="0" step="0.01" value={edit.monthlyAmountDollars} onChange={editField("monthlyAmountDollars")} />
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
                    <div className="adm-totals-note">
                      {invoice.kind === "MONTHLY" && "This total is billed every month, starting on the send date. The subscription is created on that date."}
                    </div>
                    <div className="adm-total">
                      <span>Total</span>
                      <strong>{formatCents(totalCents)}</strong>
                      {invoice.kind === "MONTHLY" && <em>/ month</em>}
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
                      return (
                        <li key={inv.id} className="adm-tl-item">
                          <div className="adm-tl-main">
                            <div className="adm-tl-title">
                              <span>{inv.title}</span>
                              <span className={`adm-pill adm-pill-${INVOICE_TONE[inv.status] || "grey"}`}>{INVOICE_LABEL[inv.status] || inv.status}</span>
                            </div>
                            <div className="adm-tl-meta">{formatCents(inv.totalCents)} · {when}</div>
                            {inv.status === "FAILED" && inv.error && <p className="adm-alert-error adm-inline">{inv.error}</p>}
                          </div>
                          <div className="adm-tl-actions">
                            {inv.hostedInvoiceUrl && (
                              <a className="adm-link" href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                                View <ExternalLink size={13} />
                              </a>
                            )}
                            {cancelable && (
                              <button className="adm-btn adm-btn-outline adm-btn-sm" onClick={() => cancelInvoice(inv)} disabled={busy === `cancel-${inv.id}`}>
                                {busy === `cancel-${inv.id}` ? "Canceling..." : "Cancel"}
                              </button>
                            )}
                          </div>
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
