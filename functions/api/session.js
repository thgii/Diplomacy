// functions/api/session.js
// Drop-in session endpoint for Cloudflare Pages Functions

// ───────────────────────────────────────────────────────────────────────────────
// Handlers
// ───────────────────────────────────────────────────────────────────────────────

export async function onRequestGet({ request, env }) {
  if (!env.DB) return send({ error: "DB not configured" }, 503);
  await ensurePlayersTable(env);

  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const pid = cookies.player_id;
  if (!pid) return send(null, 200); // soft-null, no 401 on GET

  const { results } = await env.DB
    .prepare(
      "SELECT id, email, full_name, nickname, passcode_hash, role, created_at FROM players WHERE id = ?"
    )
    .bind(pid)
    .all();

  const row = results?.[0];
  return send(row ? safePlayer(row) : null, 200);
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return send({ error: "DB not configured" }, 503);
  await ensurePlayersTable(env);

  const body = await request.json().catch(() => ({}));
  const nickname = String(body.nickname || body.name || "").trim();
  const passcode = String(body.passcode || "").trim();

  if (!nickname) return send({ error: "nickname_required" }, 400);

  // find by nickname
  const found = await env.DB
    .prepare(
      "SELECT id, email, full_name, nickname, passcode_hash, role, created_at FROM players WHERE nickname = ?"
    )
    .bind(nickname)
    .all();

  const now = new Date().toISOString();
  let player;

  if (found.results?.[0]) {
    // login path
    const row = found.results[0];
    if (row.passcode_hash) {
      if (!passcode) return send({ error: "passcode_required" }, 401);
      const ok = await verifyPasscode(passcode, row.passcode_hash);
      if (!ok) return send({ error: "invalid_passcode" }, 401);
    }
    player = safePlayer(row);
  } else {
    // create path (optional passcode)
    const id =
      globalThis.crypto?.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const email = `${id}@players.local`;
    const passcode_hash = passcode ? await hashPasscode(passcode) : null;

    await env.DB
      .prepare(
        `INSERT INTO players (id, email, full_name, nickname, passcode_hash, role, created_at)
         VALUES (?, ?, ?, ?, ?, 'player', ?)`
      )
      .bind(id, email, nickname, nickname, passcode_hash, now)
      .run();

    player = { id, email, full_name: nickname, nickname, role: "player", created_at: now };
  }

  // Set session cookie (Secure only on HTTPS; 1 year)
  const isHttps = (() => {
    try { return new URL(request.url).protocol === "https:"; } catch { return false; }
  })();

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    cookieString("player_id", player.id, {
      secure: isHttps,
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
  );

  return send(player, 200, headers);
}

export async function onRequestDelete() {
  // Logout: expire cookie immediately
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    "player_id=; Path=/; SameSite=Lax; HttpOnly; Max-Age=0"
  );
  return send(null, 204, headers);
}

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

function send(data, status = 200, extraHeaders) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  if (extraHeaders instanceof Headers) {
    extraHeaders.forEach((v, k) => headers.append(k, v));
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function safePlayer(row) {
  const { passcode_hash, ...rest } = row;
  return rest;
}

function parseCookies(header) {
  return Object.fromEntries(
    (header || "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((kv) => kv.split("="))
      .map(([k, v]) => [k, decodeURIComponent(v || "")])
  );
}

function cookieString(name, value, opts = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (opts.secure) parts.push("Secure");
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join("; ");
}

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
  await env.DB
    .prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_players_nickname ON players(nickname)`
    )
    .run();
}

// Crypto helpers
async function hashPasscode(passcode) {
  const data = new TextEncoder().encode(passcode);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function verifyPasscode(passcode, hash) {
  const h = await hashPasscode(passcode);
  return h === hash;
}
