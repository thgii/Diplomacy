// src/components/SignInGate.jsx
import React, { useEffect, useState } from "react";
import { User } from "@/api/entities";

export default function SignInGate({ children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const [nickname, setNickname] = useState("");
  const [passcode, setPasscode] = useState("");
  const [needLoginPasscode, setNeedLoginPasscode] = useState(false);
  const [needCreatePasscode, setNeedCreatePasscode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const existing = await User.me();
      if (existing?.id) setMe(existing);
      setLoading(false);
    })();
  }, []);

  function isSixDigits(s) {
    return /^\d{6}$/.test(s || "");
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Decide which passcode (if any) to send this attempt
      let passToSend = undefined;
      if (needLoginPasscode || needCreatePasscode) {
        if (!isSixDigits(passcode)) {
          alert("Passcode must be exactly 6 digits.");
          setSubmitting(false);
          return;
        }
        passToSend = passcode.trim();
      }

      const session = await User.login(nickname.trim(), passToSend);
      setMe(session);
    } catch (err) {
      const code = err?.error || err?.message || "unknown_error";

      if (code === "passcode_required") {
        // Existing nickname — require login passcode
        setNeedLoginPasscode(true);
        setNeedCreatePasscode(false);
      } else if (code === "create_passcode_required") {
        // New nickname — require creating a passcode
        setNeedCreatePasscode(true);
        setNeedLoginPasscode(false);
      } else if (code === "passcode_format") {
        alert("Passcode must be exactly 6 digits.");
      } else if (code === "invalid_passcode") {
        alert("That passcode is not correct. Try again.");
        setNeedLoginPasscode(true);
      } else if (code === "nickname_required") {
        alert("Please enter a nickname.");
      } else {
        alert(`Sign-in failed: ${code}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  if (!me) {
    const showingCreate = needCreatePasscode && !needLoginPasscode;
    const showingLogin = needLoginPasscode;

    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f7f8" }}>
        <form onSubmit={handleSignIn} style={{
          width: 360, maxWidth: "90vw", padding: 24, borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)", background: "white"
        }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Join Diplomacy</h2>
          <p style={{ marginTop: 8, color: "#666" }}>
            Enter a nickname. If it’s new, you’ll create a 6-digit passcode. If it exists, enter its passcode to log in.
          </p>

          <label style={{ display: "block", marginTop: 16, fontWeight: 600 }}>Nickname</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. StrategicSardine"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            autoFocus
          />

          {showingLogin && (
            <>
              <label style={{ display: "block", marginTop: 12, fontWeight: 600 }}>Passcode</label>
              <input
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                inputMode="numeric"
                placeholder="Enter your 6-digit passcode"
                maxLength={6}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
              />
            </>
          )}

          {showingCreate && (
            <>
              <label style={{ display: "block", marginTop: 12, fontWeight: 600 }}>Create a 6-digit passcode</label>
              <input
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                inputMode="numeric"
                placeholder="Choose 6 digits (e.g., 204867)"
                maxLength={6}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
              />
              <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                Keep this passcode safe—you’ll need it to sign in again on other devices.
              </div>
            </>
          )}

          <button type="submit" disabled={submitting} style={{
            marginTop: 14, width: "100%", padding: 12, border: "none",
            borderRadius: 8, background: "black", color: "white", fontWeight: 600
          }}>
            {submitting ? "Continuing…" : (showingCreate ? "Create & Continue" : showingLogin ? "Sign in" : "Continue")}
          </button>
        </form>
      </div>
    );
  }

  return children;
}
