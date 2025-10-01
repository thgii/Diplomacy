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

  if (!res.ok) {
    let msg;
    try { msg = await res.json(); }
    catch { msg = { error: await res.text() }; }
    throw msg; // throw object like { error: "passcode_required" }
  }
  return res.status === 204 ? null : res.json();
}
