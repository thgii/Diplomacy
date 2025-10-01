// src/api/http.js
const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const PLAYER_KEY = "player";

export function getPlayer() {
  try { return JSON.parse(localStorage.getItem(PLAYER_KEY) || "null"); }
  catch { return null; }
}
export function setPlayer(p) {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(p));
}

export async function http(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  // Keep sending X-Player-Id for any legacy endpoints that still read it.
  const p = getPlayer();
  if (p?.id) headers.set("X-Player-Id", p.id);

  // Include credentials so the session cookie is sent/received
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  // Always read the body once as text
  const bodyText = await res.text().catch(() => "");

  if (!res.ok) {
    let msg;
    try {
      msg = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      msg = { error: bodyText || res.statusText || `HTTP ${res.status}` };
    }
    throw msg; // e.g. { error: "passcode_required" }
  }

  // Happy path: parse JSON if available, otherwise return null
  if (!bodyText) return null;
  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}
