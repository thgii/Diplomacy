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

  // If not sending FormData, default to JSON content-type
  const isFormData = options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Keep sending X-Player-Id for legacy endpoints that still read it.
  const p = getPlayer();
  if (p?.id) headers.set("X-Player-Id", p.id);

  // Auto-stringify JSON bodies if caller passed a plain object
  let body = options.body;
  if (body && !isFormData && headers.get("Content-Type")?.includes("application/json") && typeof body !== "string") {
    body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body,
    credentials: "include", // include cookies/sessions
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");

  if (!res.ok) {
    let errorBody = null;
    try {
      errorBody = isJson ? await res.json() : await res.text();
    } catch {
      // ignore parse errors
    }
    const err = new Error(`HTTP ${res.status} at ${API_BASE}${path}`);
    err.status = res.status;
    err.body = errorBody;
    throw err; // upstream can inspect err.status / err.body
  }

  if (res.status === 204) return null;
  return isJson ? await res.json() : await res.text();
}
