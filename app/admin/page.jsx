"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";

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
            <Link href="/" className="brand-mark" aria-label="Kedros home">
              <span className="brand-symbol" aria-hidden="true">
                <span className="brand-arrow" />
                <span className="brand-b" />
              </span>
              <span className="brand-word">KEDR<span>O</span>S</span>
            </Link>
            <h1 style={{ marginTop: 18 }}>Admin — Clients</h1>
          </div>
          <button className="dash-signout" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
        </div>

        <form className="dash-form" onSubmit={handleSubmit}>
          <h2>Add a client</h2>
          <label>Name<input required value={form.name} onChange={handleChange("name")} placeholder="Client business name" /></label>
          <label>Email<input required type="email" value={form.email} onChange={handleChange("email")} placeholder="client@company.com" /></label>
          <label>One-time setup fee (USD)<input required type="number" min="0" step="0.01" value={form.oneTimeAmountDollars} onChange={handleChange("oneTimeAmountDollars")} placeholder="2500" /></label>
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
                <th>Setup status</th>
                <th>Subscription</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5}>Loading…</td></tr>
              )}
              {!loading && clients.length === 0 && (
                <tr><td colSpan={5}>No clients yet.</td></tr>
              )}
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.name}<br /><span style={{ color: "#656989", fontSize: 11 }}>{client.email}</span></td>
                  <td>{formatCents(client.oneTimeAmountCents)}</td>
                  <td>{formatCents(client.monthlyAmountCents)}/mo</td>
                  <td><span className={`dash-status dash-status-${client.oneTimePaidAt ? "paid" : "unpaid"}`}>{client.oneTimePaidAt ? "Paid" : "Unpaid"}</span></td>
                  <td><span className={`dash-status dash-status-${client.subscriptionStatus.toLowerCase()}`}>{client.subscriptionStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
