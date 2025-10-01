import React, { useState } from "react";
import { User } from "@/api/entities";
import { setPlayer } from "@/api/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

/**
 * Gatekeeper component:
 * - If no user session, shows nickname form
 * - Prompts for passcode only if API requires it
 */
export default function SignInGate({ children }) {
  const [nickname, setNickname] = useState("");
  const [passcode, setPasscode] = useState("");
  const [needLoginPasscode, setNeedLoginPasscode] = useState(false);
  const [needCreatePasscode, setNeedCreatePasscode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const handleSignIn = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrMsg("");

    try {
      const passToSend = needLoginPasscode || needCreatePasscode ? passcode : undefined;
      const user = await User.login(nickname.trim(), passToSend);
      if (user?.id) {
        setPlayer(user);
        window.location.reload(); // reload to re-run gate with session
      }
    } catch (err) {
      // Normalize error codes from new http/entities
      const code =
        err?.body?.error ||
        err?.body?.message ||
        err?.cause?.body?.error ||
        err?.cause?.body?.message ||
        err?.error ||
        err?.message ||
        "unknown_error";

      if (code === "passcode_required") {
        setNeedLoginPasscode(true);
        setNeedCreatePasscode(false);
        setErrMsg("Passcode required for this nickname.");
      } else if (code === "create_passcode_required") {
        setNeedCreatePasscode(true);
        setNeedLoginPasscode(false);
        setErrMsg("You must create a new passcode for this nickname.");
      } else if (code === "passcode_format") {
        setErrMsg("Passcode must be exactly 6 digits.");
      } else if (code === "invalid_passcode") {
        setNeedLoginPasscode(true);
        setErrMsg("That passcode is not correct. Try again.");
      } else if (code === "nickname_required") {
        setErrMsg("Please enter a nickname.");
      } else {
        setErrMsg(`Sign-in failed: ${code}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Already signed in? render children
  const existing = localStorage.getItem("player");
  if (existing) return children;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Sign in to Diplomacy</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Bismarck"
                required
                autoFocus
              />
            </div>

            {needLoginPasscode && (
              <div className="space-y-2">
                <Label htmlFor="passcode">Passcode</Label>
                <Input
                  id="passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter your passcode"
                  required
                />
              </div>
            )}

            {needCreatePasscode && (
              <div className="space-y-2">
                <Label htmlFor="passcode">Create Passcode</Label>
                <Input
                  id="passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Choose a 6-digit passcode"
                  required
                />
              </div>
            )}

            {errMsg && <div className="text-sm text-red-600">{errMsg}</div>}

            <Button
              type="submit"
              className="w-full"
              disabled={
                submitting ||
                !nickname.trim() ||
                ((needLoginPasscode || needCreatePasscode) && !passcode)
              }
            >
              {submitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
