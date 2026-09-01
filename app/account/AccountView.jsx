"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import BrandMark from "../BrandMark";

function formatCents(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(unixSeconds) {
  if (!unixSeconds) return "";
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

const INVOICE_LABELS = {
  paid: "Paid",
  open: "Due",
  draft: "Draft",
  uncollectible: "Unpaid",
  void: "Void"
};

export default function AccountView({ user, invoices }) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");

  const startCheckout = async (kind) => {
    setLoading(kind);
    setError("");

    const res = await fetch(`/api/checkout/${kind}`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      setLoading(null);
      return;
    }

    window.location.href = data.url;
  };

  const paid = Boolean(user.oneTimePaidAt);
  const subActive = user.subscriptionStatus === "ACTIVE";

  return (
    <div className="dash-shell">
      <div className="container">
        <div className="dash-header">
          <div>
            <BrandMark />
            <h1 style={{ marginTop: 18 }}>Welcome, {user.name}</h1>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/account/change-password" className="dash-signout">Change password</Link>
            <button className="dash-signout" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <div className="dash-cards">
          <div className="dash-card">
            <h3>One-time setup fee</h3>
            <span className={`dash-status dash-status-${paid ? "paid" : "unpaid"}`}>{paid ? "Paid" : "Unpaid"}</span>
            <p className="dash-amount">{formatCents(user.oneTimeAmountCents)}</p>
            {!paid && user.oneTimeAmountCents > 0 && (
              <button className="button button-primary" onClick={() => startCheckout("one-time")} disabled={loading === "one-time"}>
                {loading === "one-time" ? "Redirecting..." : "Pay setup fee"} <ArrowUpRight size={16} />
              </button>
            )}
          </div>
          <div className="dash-card">
            <h3>Monthly subscription</h3>
            <span className={`dash-status dash-status-${user.subscriptionStatus.toLowerCase()}`}>{user.subscriptionStatus}</span>
            <p className="dash-amount">{formatCents(user.monthlyAmountCents)}/mo</p>
            {!subActive && user.monthlyAmountCents > 0 && (
              <button className="button button-primary" onClick={() => startCheckout("subscription")} disabled={loading === "subscription"}>
                {loading === "subscription" ? "Redirecting..." : "Subscribe monthly"} <ArrowUpRight size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="dash-table" style={{ marginTop: 28 }}>
          <h3 style={{ marginBottom: 12 }}>Invoices</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr><td colSpan={5}>No invoices yet.</td></tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{formatDate(inv.created)}</td>
                  <td>{inv.description}{inv.number ? <><br /><span style={{ color: "#656989", fontSize: 11 }}>{inv.number}</span></> : null}</td>
                  <td>{formatCents(inv.status === "paid" ? inv.amountPaid : inv.amountDue)}</td>
                  <td><span className={`dash-status dash-status-${inv.status === "paid" ? "paid" : "unpaid"}`}>{INVOICE_LABELS[inv.status] || inv.status}</span></td>
                  <td>
                    {inv.status === "open" && inv.hostedInvoiceUrl && (
                      <a className="button button-primary" href={inv.hostedInvoiceUrl}>Pay <ArrowUpRight size={14} /></a>
                    )}
                    {inv.status === "paid" && inv.invoicePdf && (
                      <a className="dash-signout" href={inv.invoicePdf}>PDF</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
