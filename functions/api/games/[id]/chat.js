// functions/api/games/[id]/chat.js
// Tolerant chat endpoint that:
// - accepts ISO or array fields
// - stores participants (JSON string) & optional sender_country
// - never breaks if table already exists with a superset schema
// - returns parsed participants + created_date alias the UI expects

// Small helper
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

// Make sure the table exists with the superset of columns we may write.
// If the table already exists, this is a no-op (D1 will ignore it).
async function ensureChatTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      thread_id TEXT,
      thread_participants TEXT,           -- JSON array of emails (nullable)
      message TEXT,
      sender_email TEXT,
      sender_country TEXT,                -- nullable
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
}

function toIdLike() {
  return (globalThis.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : (Date.now().toString(36) + Math.random().toString(36).slice(2));
}

function parseParticipants(p) {
  // Accept array, stringified JSON, null/undefined
  if (Array.isArray(p)) return [...new Set(p.map(String))].sort();
  if (typeof p === "string" && p.trim().startsWith("[")) {
    try {
      const arr = JSON.parse(p);
      return Array.isArray(arr) ? [...new Set(arr.map(String))].sort() : null;
    } catch {}
  }
  return null;
}

function normalizeThreadId(v) {
  const id = (v ?? "public").toString();
  return id.trim() || "public";
}

export async function onRequestGet({ params, env }) {
  const { id } = params;
  if (!env.DB) return json([]);

  await ensureChatTable(env);

  const { results } = await env.DB
    .prepare("SELECT * FROM chat_messages WHERE game_id = ? ORDER BY datetime(created_at) ASC, id ASC")
    .bind(id)
    .all();

  const rows = (results || []).map((r) => ({
    ...r,
    // parse participants string to array for the client
    thread_participants: r.thread_participants ? (() => {
      try { const a = JSON.parse(r.thread_participants); return Array.isArray(a) ? a : null; }
      catch { return null; }
    })() : null,
    created_date: r.created_at, // alias used by UI
  }));

  return json(rows);
}

export async function onRequestPost({ request, params, env }) {
  const { id } = params;
  if (!env.DB) return json({ error: "DB not configured" }, 503);

  const body = await request.json().catch(() => ({}));

  const thread_id = normalizeThreadId(body.thread_id);
  const participantsArr = parseParticipants(body.thread_participants);
  const message = (body.message ?? "").toString().trim();
  // Try to get sender from body; fallback to a header; finally a local id
  const sender_email =
    (body.sender_email && String(body.sender_email)) ||
    request.headers.get("x-player-email") ||
    (request.headers.get("x-player-id") ? `${request.headers.get("x-player-id")}@players.local` : null);

  const sender_country = body.sender_country ? String(body.sender_country) : null;

  // Minimal validation: must have at least a message and some sender identifier
  if (!message || !sender_email) {
    return json({ error: "message and sender_email are required" }, 400);
  }

  await ensureChatTable(env);

  const idStr = toIdLike();
  const participantsJson = participantsArr ? JSON.stringify(participantsArr) : null;

  // Build an INSERT that covers the superset of columns. Older tables without
  // these columns ignore the extra bound values if we explicitly list columns.
  await env.DB.prepare(
    `INSERT INTO chat_messages
      (id, game_id, thread_id, thread_participants, message, sender_email, sender_country)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(idStr, id, thread_id, participantsJson, message, sender_email, sender_country).run();

  // Return the inserted row
  const { results } = await env.DB
    .prepare("SELECT * FROM chat_messages WHERE id = ?")
    .bind(idStr)
    .all();

  const row = results?.[0] || {
    id: idStr,
    game_id: id,
    thread_id,
    thread_participants: participantsJson,
    message,
    sender_email,
    sender_country,
    created_at: new Date().toISOString(),
  };

  return json(
    {
      ...row,
      thread_participants: row.thread_participants ? JSON.parse(row.thread_participants) : null,
      created_date: row.created_at,
    },
    201
  );
}
