"use client";

import { useState } from "react";
import Link from "next/link";

export default function ChangePasswordView({ forced }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const change = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.newPassword !== form.confirm) {
      setError("New passwords do not match.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword })
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    window.location.href = "/account";
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Link href="/" className="brand-mark" aria-label="Kedros home">
          <span className="brand-word">KEDR<span>O</span>S</span>
        </Link>
        <h1>Change password</h1>
        <p>
          {forced
            ? "Set your own password to continue to your account."
            : "Update the password you use to sign in."}
        </p>

        <form onSubmit={submit}>
          <label>Current password
            <input required type="password" value={form.currentPassword} onChange={change("currentPassword")} />
          </label>
          <label>New password
            <input required type="password" minLength={8} value={form.newPassword} onChange={change("newPassword")} />
          </label>
          <label>Confirm new password
            <input required type="password" minLength={8} value={form.confirm} onChange={change("confirm")} />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button className="button button-primary" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save password"}
          </button>
        </form>

        {!forced && <p style={{ marginTop: 16 }}><Link href="/account">Back to account</Link></p>}
      </div>
    </div>
  );
}
