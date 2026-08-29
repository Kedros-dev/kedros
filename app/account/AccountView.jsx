"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

function formatCents(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function AccountView({ user }) {
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
            <Link href="/" className="brand-mark" aria-label="Kedros home">
              <span className="brand-symbol" aria-hidden="true">
                <span className="brand-arrow" />
                <span className="brand-b" />
              </span>
              <span className="brand-word">KEDR<span>O</span>S</span>
            </Link>
            <h1 style={{ marginTop: 18 }}>Welcome, {user.name}</h1>
          </div>
          <button className="dash-signout" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
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
      </div>
    </div>
  );
}
