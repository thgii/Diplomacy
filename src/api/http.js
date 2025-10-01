// src/api/http.js
const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const PLAYER_KEY = "player";

export function getPlayer() {
  try {
    return JSON.parse(localStorage.getItem(PLAYER_KEY) || "null");
  } catch {
    return null;
  }
}

export function setPlayer(p) {
  if (!p) localStorage.removeItem(PLAYER_KEY);
  else localStorage.setItem(PLAYER_KEY, JSON.stringify(p));
}

function ensureLeadingSlash(path) {
  return path.startsWith("/") ? path : `/${path}`;
}

function shouldSendPlayerHeader(path, method = "GET") {
  const p = ensureLeadingSlash(path);
  const m = (method || "GET").toUpperCase();
  // Do not send X-Player-Id on auth endpoints to avoid 401 during login/logout
  if (p === "/session" && (m === "POST" || m === "DELETE")) return false;
  return true;
}

export async function http(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const method = (options.method || "GET").toUpperCase();

  // Content-Type unless using FormData
  const isFormData = options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Attach X-Player-Id only when appropriate
  if (shouldSendPlayerHeader(path, method)) {
    const p = getPlayer();
    if (p?.id) headers.set("X-Player-Id", p.id);
  }

  // Auto-stringify JSON bodies
  let body = options.body;
  if (
    body &&
    !isFormData &&
    headers.get("Content-Type")?.includes("application/json") &&
    typeof body !== "string"
  ) {
    body = JSON.stringify(body);
  }

  const url = `${API_BASE}${ensureLeadingSlash(path)}`;
  const res = await fetch(url, {
    ...options,
    method,
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
    const err = new Error(`HTTP ${res.status} at ${url}`);
    err.status = res.status;
    err.body = errorBody;
    throw err;
  }

  if (res.status === 204) return null;
  return isJson ? await res.json() : await res.text();
}
