"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import BrandMark from "../BrandMark";

function formatCents(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function AdminPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", oneTimeAmountDollars: "", monthlyAmountDollars: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
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
    setSubmitting(true);
    setError("");
    setCreated(null);

    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    setCreated({ email: data.client.email, tempPassword: data.tempPassword });
    setForm({ name: "", email: "", oneTimeAmountDollars: "", monthlyAmountDollars: "" });
    loadClients();
  };

  return (
    <div className="dash-shell">
      <div className="container">
        <div className="dash-header">
          <div>
            <BrandMark />
            <h1 style={{ marginTop: 18 }}>Admin — Clients</h1>
          </div>
          <button className="dash-signout" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
        </div>

        <form className="dash-form" onSubmit={handleSubmit}>
          <h2>Add a client</h2>
          <label>Name<input required value={form.name} onChange={handleChange("name")} placeholder="Client business name" /></label>
          <label>Email<input required type="email" value={form.email} onChange={handleChange("email")} placeholder="client@company.com" /></label>
          <label>Setup fee — first invoice (USD)<input required type="number" min="0" step="0.01" value={form.oneTimeAmountDollars} onChange={handleChange("oneTimeAmountDollars")} placeholder="2500" /></label>
          <label>Monthly subscription (USD)<input required type="number" min="0" step="0.01" value={form.monthlyAmountDollars} onChange={handleChange("monthlyAmountDollars")} placeholder="150" /></label>

          {error && <p className="auth-error">{error}</p>}

          <button className="button button-primary form-submit" type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create client"}
          </button>

          {created && (
            <div className="dash-credentials">
              Share these login details with the client:<br />
              Email: {created.email}<br />
              Temporary password: {created.tempPassword}
            </div>
          )}
        </form>

        <div className="dash-table">
          <table>
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
              {loading && <tr><td colSpan={6}>Loading…</td></tr>}
              {!loading && clients.length === 0 && <tr><td colSpan={6}>No clients yet.</td></tr>}
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
  const [bill, setBill] = useState({ amountDollars: "", description: "" });
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

  const sendInvoice = async () => {
    const data = await call("bill", `/api/admin/clients/${client.id}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bill)
    });
    if (data) {
      setMsg(
        `Invoice ${data.invoice.number || ""} created — it's on the client's account page.` +
          (data.invoice.emailed ? " Emailed to the client." : "")
      );
      setBill({ amountDollars: "", description: "" });
    }
  };

  const cancelSub = async () => {
    const data = await call("cancelsub", `/api/admin/clients/${client.id}/subscription`, { method: "DELETE" });
    if (data) {
      setMsg("Subscription canceled.");
      onChanged();
    }
  };

  const editField = (field) => (e) => setEdit((p) => ({ ...p, [field]: e.target.value }));
  const billField = (field) => (e) => setBill((p) => ({ ...p, [field]: e.target.value }));

  return (
    <>
      <tr>
        <td>{client.name}<br /><span style={{ color: "#656989", fontSize: 11 }}>{client.email}</span></td>
        <td>{formatCents(client.oneTimeAmountCents)}</td>
        <td>{formatCents(client.monthlyAmountCents)}/mo</td>
        <td><span className={`dash-status dash-status-${client.subscriptionStatus.toLowerCase()}`}>{client.subscriptionStatus}</span></td>
        <td><span className={`dash-status dash-status-${client.isActive ? "paid" : "unpaid"}`}>{client.isActive ? "Active" : "Deactivated"}</span></td>
        <td><button className="dash-signout" onClick={onToggle}>{open ? "Close" : "Manage"}</button></td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6}>
            <div style={{ display: "grid", gap: 18, padding: "6px 2px 14px" }}>
              {msg && <p style={{ color: "#1f7a3d", fontSize: 13 }}>{msg}</p>}
              {err && <p className="auth-error">{err}</p>}

              <div style={{ display: "grid", gap: 8, maxWidth: 460 }}>
                <strong style={{ fontSize: 12, letterSpacing: 0.4 }}>DETAILS</strong>
                <label>Name<input value={edit.name} onChange={editField("name")} /></label>
                <label>Email<input type="email" value={edit.email} onChange={editField("email")} /></label>
                <label>Setup fee (USD)<input type="number" min="0" step="0.01" value={edit.oneTimeAmountDollars} onChange={editField("oneTimeAmountDollars")} /></label>
                <label>Monthly (USD)<input type="number" min="0" step="0.01" value={edit.monthlyAmountDollars} onChange={editField("monthlyAmountDollars")} /></label>
                <button className="button button-primary" onClick={saveEdit} disabled={busy === "edit"}>{busy === "edit" ? "Saving..." : "Save details"}</button>
              </div>

              <div style={{ display: "grid", gap: 8, maxWidth: 460 }}>
                <strong style={{ fontSize: 12, letterSpacing: 0.4 }}>BILL AN AMOUNT (sends a Stripe invoice by email)</strong>
                <label>Amount (USD)<input type="number" min="0" step="0.01" value={bill.amountDollars} onChange={billField("amountDollars")} placeholder="500" /></label>
                <label>Description<input value={bill.description} onChange={billField("description")} placeholder="Annual renewal" /></label>
                <button className="button button-primary" onClick={sendInvoice} disabled={busy === "bill"}>{busy === "bill" ? "Sending..." : "Create & send invoice"}</button>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="dash-signout" onClick={resetPassword} disabled={busy === "reset"}>Reset password</button>
                <button className="dash-signout" onClick={toggleActive} disabled={busy === "active"}>
                  {client.isActive ? "Deactivate account" : "Activate account"}
                </button>
                {client.subscriptionStatus === "ACTIVE" && (
                  <button className="dash-signout" onClick={cancelSub} disabled={busy === "cancelsub"}>Cancel subscription</button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
