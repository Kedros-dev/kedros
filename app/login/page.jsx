"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "deactivated") {
      setError("This account has been deactivated. Contact Kedros for help.");
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    setLoading(false);

    if (result?.error) {
      setError(
        /deactiv/i.test(result.error)
          ? "This account has been deactivated. Contact Kedros for help."
          : "Incorrect email or password."
      );
      return;
    }

    router.push("/account");
    router.refresh();
  };

  return (
    <div className="site-shell auth-shell">
      <div className="container auth-wrap">
        <Link href="/" className="brand-mark" aria-label="Kedros home">
          <span className="brand-symbol" aria-hidden="true">
            <span className="brand-arrow" />
            <span className="brand-b" />
          </span>
          <span className="brand-word">KEDR<span>O</span>S</span>
        </Link>

        <form className="contact-form auth-form" onSubmit={handleSubmit}>
          <h1 className="auth-title">Client login</h1>
          <p className="auth-subtitle">Sign in to manage your account and billing.</p>

          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></label>
          <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>

          {error && <p className="auth-error">{error}</p>}

          <button className="button button-primary form-submit" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"} <ArrowUpRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
