// functions/api/session.js
import { json } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "DB not configured" }, 503);
  await ensurePlayersTable(env);

  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const body = await request.json().catch(() => ({}));
  const nickname = (body.nickname || body.name || "").toString().trim();
  const passcode = (body.passcode || "").toString().trim(); // create OR login

  // Reuse existing session if present
  if (cookies.player_id) {
    const { results } = await env.DB
      .prepare("SELECT id, email, full_name, nickname, passcode_hash, role, created_at FROM players WHERE id = ?")
      .bind(cookies.player_id)
      .all();
    const row = results?.[0];
    if (row) return withSessionCookie(json(safePlayer(row)), row.id);
  }

  if (!nickname) return json({ error: "nickname_required" }, 400);

  // Find by nickname
  const found = await env.DB
    .prepare("SELECT id, email, full_name, nickname, passcode_hash, role, created_at FROM players WHERE nickname = ?")
    .bind(nickname)
    .all();

  if (found.results?.[0]) {
    // Existing nickname: require passcode
    const row = found.results[0];
    if (!row.passcode_hash) return json({ error: "passcode_not_set_contact_admin" }, 403);
    if (!passcode) return json({ error: "passcode_required" }, 401);
    if (!isSixDigits(passcode)) return json({ error: "passcode_format" }, 400);

    const ok = await verifyPasscode(passcode, row.passcode_hash);
    if (!ok) return json({ error: "invalid_passcode" }, 401);
    return withSessionCookie(json(safePlayer(row)), row.id);
  }

  // New nickname: user must create a 6-digit passcode
  if (!passcode) return json({ error: "create_passcode_required" }, 400);
  if (!isSixDigits(passcode)) return json({ error: "passcode_format" }, 400);

  const id = crypto.randomUUID();
  const passcode_hash = await hashPasscode(passcode);

  // Keep email/full_name compatibility (email is a placeholder)
  const email = `${id}@players.local`;
  const full_name = nickname;

  await env.DB.prepare(
    `INSERT INTO players (id, email, full_name, nickname, passcode_hash, role, created_at)
     VALUES (?, ?, ?, ?, ?, 'player', datetime('now'))`
  ).bind(id, email, full_name, nickname, passcode_hash).run();

  const created = { id, email, full_name, nickname, created_at: new Date().toISOString() };
  return withSessionCookie(json(created, 201), id);
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "DB not configured" }, 503);
  await ensurePlayersTable(env);

  const cookies = parseCookies(request.headers.get("Cookie") || "");
  if (!cookies.player_id) return json({ player: null });

  const { results } = await env.DB
    .prepare("SELECT id, email, full_name, nickname, passcode_hash, role, created_at FROM players WHERE id = ?")
    .bind(cookies.player_id)
    .all();

  const row = results?.[0];
  return json(row ? safePlayer(row) : { player: null });
}

export async function onRequestDelete() {
  // sign out: clear cookie
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": cookieString("player_id", "", { maxAge: 0 }) },
  });
}

/* ---------------- helpers ---------------- */

async function ensurePlayersTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      full_name TEXT,
      nickname TEXT UNIQUE,
      passcode_hash TEXT,
      role TEXT DEFAULT 'player',
      created_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();
  await env.DB.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_players_nickname ON players(nickname)`
  ).run();
}

function parseCookies(header) {
  return header.split(";").reduce((acc, p) => {
    const [k, v] = p.split("=").map(s => s.trim());
    if (k && v) acc[k] = decodeURIComponent(v);
    return acc;
  }, {});
}

function withSessionCookie(resp, playerId) {
  const headers = new Headers(resp.headers);
  headers.set("Set-Cookie", cookieString("player_id", playerId, { httpOnly: true, sameSite: "Lax" }));
  return new Response(resp.body, { status: resp.status, headers });
}

function cookieString(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  parts.push("Path=/", "SameSite=Lax", "Secure"); // assumes HTTPS
  if (opts.maxAge === 0) parts.push("Max-Age=0");
  return parts.join("; ");
}

function safePlayer(row) {
  const { passcode_hash, ...rest } = row;
  return rest;
}

function isSixDigits(s) {
  return /^\d{6}$/.test(s);
}

// Crypto: SHA-256 hex
async function hashPasscode(passcode) {
  const data = new TextEncoder().encode(passcode);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPasscode(passcode, hash) {
  const h = await hashPasscode(passcode);
  return h === hash;
}
