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
  const p = getPlayer();
  if (p?.id) headers.set("X-Player-Id", p.id); // identify the caller
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}
