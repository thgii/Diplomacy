// src/components/SignInGate.jsx
import React, { useEffect, useState } from "react";
import { User } from "@/api/entities";

export default function SignInGate({ children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const existing = User.me();
    setMe(existing);
    setLoading(false);
  }, []);

  async function handleSignIn(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      setSubmitting(true);
      const session = await User.login(trimmed);
      setMe(session);
      setSubmitting(false);
    } catch (err) {
      setSubmitting(false);
      alert("Sign-in failed: " + (err?.message || err));
    }
  }

  if (loading) return null;

  if (!me) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <form onSubmit={handleSignIn} style={{
          width: 360, maxWidth: "90vw", padding: 24, borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)", background: "white"
        }}>
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>Enter the Arena</h2>
          <p style={{ marginTop: 0, marginBottom: 16 }}>Pick a display name your friends will see:</p>
          <input
            value={name}
            onChange={(e)=>setName(e.target.value)}
            placeholder="e.g., Captain Vienna"
            disabled={submitting}
            style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <button type="submit" disabled={submitting} style={{
            marginTop: 12, width: "100%", padding: 12, border: "none",
            borderRadius: 8, background: "black", color: "white", fontWeight: 600
          }}>
            {submitting ? "Signing in…" : "Continue"}
          </button>
        </form>
      </div>
    );
  }

  return children;
}
