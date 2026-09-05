"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import BrandMark from "../BrandMark";
import { resolveSplitPercentages, computeSplitCents, sumPercentages } from "@/lib/partnerSplit";

function formatCents(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function partnerName(partners, partnerId) {
  const partner = partners.find((p) => p.id === partnerId);
  return partner ? partner.name : "Unknown";
}

// Brought-by dropdown options: every active partner, plus "Referral" (no partner) as "".
function sourceOptions(partners) {
  return [{ value: "", label: "Referral" }, ...partners.filter((p) => p.active).map((p) => ({ value: p.id, label: p.name }))];
}

function SplitPreview({ amountCents, source, partners, rules }) {
  const percentages = resolveSplitPercentages(source, rules);
  if (!percentages) {
    return <p style={{ color: "#b3261e", fontSize: 12, margin: 0 }}>No split rule defined for this combination yet — set one below or use an override.</p>;
  }
  const split = computeSplitCents(amountCents, percentages);
  const total = sumPercentages(percentages);
  return (
    <p style={{ color: "#656989", fontSize: 12, margin: 0 }}>
      Split: {Object.entries(split).map(([partnerId, cents]) => `${partnerName(partners, partnerId)} ${formatCents(cents)}`).join(" · ")}
      {total !== 100 && <span style={{ color: "#b3261e" }}> (percentages add up to {total}%)</span>}
    </p>
  );
}

function PartnerTotals({ clients, partners, rules }) {
  const totals = {};
  for (const partner of partners) totals[partner.id] = 0;

  for (const client of clients) {
    if (client.subscriptionStatus !== "ACTIVE") continue;
    const percentages = resolveSplitPercentages(client, rules);
    if (!percentages) continue;
    const split = computeSplitCents(client.monthlyAmountCents, percentages);
    for (const [partnerId, cents] of Object.entries(split)) {
      totals[partnerId] = (totals[partnerId] || 0) + cents;
    }
  }

  const partnerIds = partners.filter((p) => p.active || totals[p.id] > 0).map((p) => p.id);
  if (partnerIds.length === 0) return null;

  return (
    <div className="dash-form" style={{ display: "grid", gap: 8 }}>
      <h2>Partner payouts (active monthly subscriptions)</h2>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {partnerIds.map((partnerId) => (
          <div key={partnerId}>
            <div style={{ color: "#656989", fontSize: 12 }}>{partnerName(partners, partnerId)}</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{formatCents(totals[partnerId])}/mo</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PartnersManager({ partners, onChanged }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const addPartner = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "Could not add partner.");
      return;
    }
    setName("");
    onChanged();
  };

  const toggleActive = async (partner) => {
    await fetch(`/api/admin/partners/${partner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !partner.active })
    });
    onChanged();
  };

  return (
    <div className="dash-form" style={{ display: "grid", gap: 12 }}>
      <h2>Partners</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {partners.map((partner) => (
          <div key={partner.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13, color: "#0f134e" }}>{partner.name}</span>
            <span className={`dash-status dash-status-${partner.active ? "paid" : "unpaid"}`}>{partner.active ? "Active" : "Inactive"}</span>
            <button type="button" className="dash-signout" onClick={() => toggleActive(partner)}>
              {partner.active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        ))}
        {partners.length === 0 && <p style={{ color: "#656989", fontSize: 13 }}>No partners yet.</p>}
      </div>
      <form onSubmit={addPartner} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <label style={{ flex: 1, margin: 0 }}>Add partner<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Partner name" /></label>
        <button className="button button-primary" type="submit" disabled={busy} style={{ whiteSpace: "nowrap" }}>{busy ? "Adding..." : "Add"}</button>
      </form>
      {err && <p className="auth-error">{err}</p>}
      <p style={{ color: "#656989", fontSize: 12, margin: 0 }}>
        Deactivating a partner removes them from new selections but keeps their historical splits intact. After adding a partner, set their default split percentages below.
      </p>
    </div>
  );
}

function buildSplitRuleMatrix(rules) {
  const matrix = { true: {}, false: {} };
  for (const rule of rules) {
    const supervisingKey = rule.supervisingRequired ? "true" : "false";
    const sourceKey = rule.broughtByPartnerId || "REFERRAL";
    matrix[supervisingKey][sourceKey] = { ruleId: rule.id, splits: { ...(rule.splits || {}) } };
  }
  return matrix;
}

const cellInputStyle = { width: 56, padding: "6px 4px", border: "1px solid #cad4e1", borderRadius: 4, fontSize: 13, textAlign: "center" };
const matrixThStyle = { borderBottom: "1px solid #cad4e1", color: "#656989", fontFamily: "DM Mono", fontSize: 10, letterSpacing: ".05em", padding: "10px 12px", textAlign: "left", textTransform: "uppercase" };
const matrixTdStyle = { borderBottom: "1px solid #f0f1f5", color: "#0f134e", fontSize: 13, padding: "8px 12px" };

function SplitRulesEditor({ partners, rules, onSaved }) {
  const activePartners = partners.filter((p) => p.active);
  const sources = [{ key: "REFERRAL", label: "Referral" }, ...activePartners.map((p) => ({ key: p.id, label: p.name }))];

  const [matrix, setMatrix] = useState(() => buildSplitRuleMatrix(rules));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const setCell = (supervisingKey, sourceKey, partnerId, value) => {
    setMatrix((prev) => {
      const existing = prev[supervisingKey][sourceKey] || { ruleId: null, splits: {} };
      const splits = { ...existing.splits };
      if (value === "") delete splits[partnerId];
      else splits[partnerId] = value;
      return { ...prev, [supervisingKey]: { ...prev[supervisingKey], [sourceKey]: { ...existing, splits } } };
    });
  };

  const save = async () => {
    setSaving(true);
    setMsg("");
    setErr("");

    const payload = [];
    for (const supervisingKey of ["true", "false"]) {
      for (const source of sources) {
        const cell = matrix[supervisingKey][source.key];
        if (!cell) continue;
        payload.push({
          id: cell.ruleId,
          broughtByPartnerId: source.key === "REFERRAL" ? null : source.key,
          supervisingRequired: supervisingKey === "true",
          splits: cell.splits
        });
      }
    }

    const res = await fetch("/api/admin/split-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules: payload })
    });
    setSaving(false);
    if (!res.ok) {
      setErr("Could not save split rules.");
      return;
    }
    setMsg("Saved.");
    onSaved();
  };

  const renderTable = (supervisingKey, title) => (
    <div style={{ overflowX: "auto" }}>
      <strong style={{ fontSize: 12, letterSpacing: 0.4, color: "#0f134e" }}>{title}</strong>
      <table style={{ borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr>
            <th style={matrixThStyle}></th>
            {sources.map((source) => <th key={source.key} style={matrixThStyle}>{source.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {activePartners.map((partner) => (
            <tr key={partner.id}>
              <td style={{ ...matrixTdStyle, fontWeight: 600 }}>{partner.name}</td>
              {sources.map((source) => {
                const cell = matrix[supervisingKey][source.key];
                const value = cell?.splits?.[partner.id] ?? "";
                return (
                  <td key={source.key} style={matrixTdStyle}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      style={cellInputStyle}
                      value={value}
                      onChange={(e) => setCell(supervisingKey, source.key, partner.id, e.target.value)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ background: "#fff", boxShadow: "0 20px 60px rgba(15,19,78,.06)", padding: 32, display: "grid", gap: 16 }}>
      <h2 style={{ color: "#0f134e", fontSize: 18, fontWeight: 700, margin: 0 }}>Default split rules (%)</h2>
      {activePartners.length === 0 && <p style={{ color: "#656989", fontSize: 13 }}>Add at least one partner above first.</p>}
      {activePartners.length > 0 && (
        <>
          {renderTable("true", "Supervising required")}
          {renderTable("false", "Supervising NOT required")}
          {msg && <p style={{ color: "#1f7a3d", fontSize: 13 }}>{msg}</p>}
          {err && <p className="auth-error">{err}</p>}
          <button className="button button-primary" style={{ width: "fit-content" }} onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save split rules"}
          </button>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [clients, setClients] = useState([]);
  const [partners, setPartners] = useState([]);
  const [rules, setRules] = useState([]);
  const [rulesVersion, setRulesVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    oneTimeAmountDollars: "",
    monthlyAmountDollars: "",
    broughtByPartnerId: "",
    supervisingRequired: true
  });
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

  const loadPartners = async () => {
    const res = await fetch("/api/admin/partners");
    const data = await res.json();
    setPartners(data.partners || []);
  };

  const loadRules = async () => {
    const res = await fetch("/api/admin/split-rules");
    const data = await res.json();
    setRules(data.rules || []);
    setRulesVersion((v) => v + 1);
  };

  useEffect(() => {
    loadClients();
    loadPartners();
    loadRules();
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
      body: JSON.stringify({ ...form, broughtByPartnerId: form.broughtByPartnerId || null })
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    setCreated({ email: data.client.email, tempPassword: data.tempPassword });
    setForm({ name: "", email: "", oneTimeAmountDollars: "", monthlyAmountDollars: "", broughtByPartnerId: "", supervisingRequired: true });
    loadClients();
  };

  return (
    <div className="dash-shell">
      <div className="container">
        <div className="dash-header">
          <div>
            <BrandMark />
            <h1 style={{ marginTop: 18 }}>Admin: Clients</h1>
          </div>
          <button className="dash-signout" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
        </div>

        <div style={{ display: "grid", gap: 24, marginBottom: 24 }}>
          <PartnerTotals clients={clients} partners={partners} rules={rules} />
          <PartnersManager partners={partners} onChanged={() => { loadPartners(); loadRules(); }} />
          <SplitRulesEditor key={rulesVersion} partners={partners} rules={rules} onSaved={loadRules} />
        </div>

        <form className="dash-form" onSubmit={handleSubmit}>
          <h2>Add a client</h2>
          <label>Name<input required value={form.name} onChange={handleChange("name")} placeholder="Client business name" /></label>
          <label>Email<input required type="email" value={form.email} onChange={handleChange("email")} placeholder="client@company.com" /></label>
          <label>Setup fee, first invoice (USD)<input required type="number" min="0" step="0.01" value={form.oneTimeAmountDollars} onChange={handleChange("oneTimeAmountDollars")} placeholder="2500" /></label>
          <label>Monthly subscription (USD)<input required type="number" min="0" step="0.01" value={form.monthlyAmountDollars} onChange={handleChange("monthlyAmountDollars")} placeholder="150" /></label>
          <label>Brought by
            <select value={form.broughtByPartnerId} onChange={handleChange("broughtByPartnerId")}>
              {sourceOptions(partners).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.supervisingRequired}
              onChange={(e) => setForm((prev) => ({ ...prev, supervisingRequired: e.target.checked }))}
            />
            Supervising required
          </label>
          {form.monthlyAmountDollars && (
            <SplitPreview
              amountCents={Math.round(Number(form.monthlyAmountDollars) * 100)}
              source={{ broughtByPartnerId: form.broughtByPartnerId || null, supervisingRequired: form.supervisingRequired, splitOverride: null }}
              partners={partners}
              rules={rules}
            />
          )}

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
                  partners={partners}
                  rules={rules}
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

function ClientRow({ client, partners, rules, open, onToggle, onChanged }) {
  const activePartners = partners.filter((p) => p.active);

  const [edit, setEdit] = useState({
    name: client.name,
    email: client.email,
    oneTimeAmountDollars: (client.oneTimeAmountCents / 100).toString(),
    monthlyAmountDollars: (client.monthlyAmountCents / 100).toString(),
    broughtByPartnerId: client.broughtByPartnerId || "",
    supervisingRequired: client.supervisingRequired,
    overrideEnabled: Boolean(client.splitOverride),
    overrideValues: client.splitOverride || {}
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
    const payload = {
      name: edit.name,
      email: edit.email,
      oneTimeAmountDollars: edit.oneTimeAmountDollars,
      monthlyAmountDollars: edit.monthlyAmountDollars,
      broughtByPartnerId: edit.broughtByPartnerId || null,
      supervisingRequired: edit.supervisingRequired,
      splitOverride: edit.overrideEnabled ? edit.overrideValues : null
    };
    const data = await call("edit", `/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
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
        `Invoice ${data.invoice.number || ""} created. It's on the client's account page.` +
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

  const deleteClient = async () => {
    if (!window.confirm(`Permanently delete ${client.name}? Their Stripe invoice history is kept, but the login and account are removed.`)) {
      return;
    }
    const data = await call("delete", `/api/admin/clients/${client.id}`, { method: "DELETE" });
    if (data) onChanged();
  };

  const editField = (field) => (e) => setEdit((p) => ({ ...p, [field]: e.target.value }));
  const billField = (field) => (e) => setBill((p) => ({ ...p, [field]: e.target.value }));

  const toggleOverride = (e) => {
    const enabled = e.target.checked;
    setEdit((prev) => {
      if (!enabled) return { ...prev, overrideEnabled: false };
      const defaults = resolveSplitPercentages(
        { broughtByPartnerId: prev.broughtByPartnerId || null, supervisingRequired: prev.supervisingRequired, splitOverride: null },
        rules
      ) || {};
      return {
        ...prev,
        overrideEnabled: true,
        overrideValues: Object.fromEntries(activePartners.map((p) => [p.id, defaults[p.id] ?? ""]))
      };
    });
  };

  return (
    <>
      <tr>
        <td>{client.name}<br /><span style={{ color: "#656989", fontSize: 11 }}>{client.email}</span></td>
        <td>{formatCents(client.oneTimeAmountCents)}{client.oneTimePaidAt && <span style={{ color: "#1f7a3d", fontSize: 11 }}><br />paid</span>}</td>
        <td>
          {formatCents(client.monthlyAmountCents)}/mo
          <br />
          <SplitPreview amountCents={client.monthlyAmountCents} source={client} partners={partners} rules={rules} />
        </td>
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
                <label>Setup fee (USD)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={edit.oneTimeAmountDollars}
                    onChange={editField("oneTimeAmountDollars")}
                    disabled={Boolean(client.oneTimePaidAt)}
                  />
                  {client.oneTimePaidAt && (
                    <span style={{ color: "#656989", fontSize: 11 }}>Paid, locked</span>
                  )}
                </label>
                <label>Monthly (USD)<input type="number" min="0" step="0.01" value={edit.monthlyAmountDollars} onChange={editField("monthlyAmountDollars")} /></label>
                <label>Brought by
                  <select value={edit.broughtByPartnerId} onChange={editField("broughtByPartnerId")}>
                    {sourceOptions(partners).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={edit.supervisingRequired}
                    onChange={(e) => setEdit((prev) => ({ ...prev, supervisingRequired: e.target.checked }))}
                  />
                  Supervising required
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={edit.overrideEnabled} onChange={toggleOverride} />
                  Override split for this project
                </label>
                {edit.overrideEnabled && (
                  <div style={{ display: "grid", gap: 8, paddingLeft: 4 }}>
                    {activePartners.map((partner) => (
                      <label key={partner.id}>{partner.name} %
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={edit.overrideValues[partner.id] ?? ""}
                          onChange={(e) => setEdit((prev) => ({ ...prev, overrideValues: { ...prev.overrideValues, [partner.id]: e.target.value } }))}
                        />
                      </label>
                    ))}
                  </div>
                )}

                <SplitPreview
                  amountCents={Math.round(Number(edit.monthlyAmountDollars || 0) * 100)}
                  source={{
                    broughtByPartnerId: edit.broughtByPartnerId || null,
                    supervisingRequired: edit.supervisingRequired,
                    splitOverride: edit.overrideEnabled ? edit.overrideValues : null
                  }}
                  partners={partners}
                  rules={rules}
                />

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
                <button className="dash-signout" onClick={deleteClient} disabled={busy === "delete"} style={{ color: "#b3261e", borderColor: "#b3261e" }}>Delete client</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
