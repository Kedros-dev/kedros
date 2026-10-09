"use client";

import { useEffect, useRef, useState } from "react";
import { TERMS_CONTENT } from "@/lib/terms";

const { title, subtitle, intro, items, footnote, checkboxLabel, buttonLabel } = TERMS_CONTENT;

const FOCUSABLE_SELECTOR =
  'input:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export default function TermsModal({ onAccepted }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const checkboxRef = useRef(null);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Focus the checkbox on mount.
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.focus();
    }
  }, []);

  // Escape is swallowed (no dismiss); Tab is trapped inside the dialog.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleAccept() {
    if (!checked || busy) return;
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/account/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });

      let data = {};
      try {
        data = (await res.json()) || {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      if (onAccepted) onAccepted();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="terms-overlay">
      <div
        className="terms-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-dialog-title"
        ref={dialogRef}
      >
        <div className="terms-head">
          <div className="terms-mark" aria-hidden="true">K</div>
          <div>
            <h2 id="terms-dialog-title" className="terms-title">{title}</h2>
            <p className="terms-subtitle">{subtitle}</p>
          </div>
        </div>
        <p className="terms-intro">{intro}</p>
        <ul className="terms-list">
          {items.map((item) => (
            <li key={item.title} className="terms-item">
              <span className={`terms-badge terms-badge-${item.tone}`}>{item.badge}</span>
              <div>
                <h3 className="terms-item-title">{item.title}</h3>
                <p className="terms-item-text">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="terms-foot">{footnote}</p>
        <label className="terms-check">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            disabled={busy}
          />
          <span>{checkboxLabel}</span>
        </label>
        {error && <p className="terms-error" role="alert">{error}</p>}
        <button
          type="button"
          className="terms-btn"
          onClick={handleAccept}
          disabled={!checked || busy}
        >
          {busy ? "Saving..." : buttonLabel}
        </button>
      </div>
    </div>
  );
}
