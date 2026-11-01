"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SellerLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/seller/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Could not sign in.");
      }
      router.replace("/seller");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="seller-gate">
      <div>
        <Link className="gate-brand" href="/">Kawan, Makan Lah!</Link>
        <h1>Seller sign in</h1>
        <p>Enter the seller password to manage orders and stock.</p>
        <form className="seller-login-form" onSubmit={submit}>
          <label htmlFor="seller-password">Password</label>
          <input
            id="seller-password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="seller-login-error" role="alert">{error}</p>}
          <button className="gate-button" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

