// functions/api/games/[id]/chat.js
// Robust chat endpoint for Cloudflare Pages (D1).
// - GET: returns all messages for a game_id, newest last
// - POST: validates, ensures table & columns, inserts, returns row
// - Tolerant to older schemas: adds missing columns (thread_participants, sender_country)

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });

// Ensure table exists AND required columns are present (idempotent).
async function ensureChatSchema(env) {
  // Base table
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      thread_id TEXT,
      message TEXT,
      sender_email TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // Add columns if missing
  const { results } = await env.DB.prepare(`PRAGMA table_info('chat_messages')`).all();
  const have = new Set((results || []).map(r => r.name));

  if (!have.has('thread_participants')) {
    await env.DB.prepare(`ALTER TABLE chat_messages ADD COLUMN thread_participants TEXT`).run();
  }
  if (!have.has('sender_country')) {
    await env.DB.prepare(`ALTER TABLE chat_messages ADD COLUMN sender_country TEXT`).run();
  }
}

function normalizeThreadId(v) {
  const s = (v ?? "public").toString().trim();
  return s || "public";
}
function parseParticipants(p) {
  // Accept array or JSON string; else null (public)
  if (Array.isArray(p)) return [...new Set(p.map(String))].sort();
  if (typeof p === "string" && p.trim().startsWith("[")) {
    try {
      const arr = JSON.parse(p);
      return Array.isArray(arr) ? [...new Set(arr.map(String))].sort() : null;
    } catch {}
  }
  return null;
}
function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

export async function onRequestGet({ params, env }) {
  const { id } = params;
  if (!env.DB) return json([]);

  await ensureChatSchema(env);

  const { results } = await env.DB
    .prepare(
      `SELECT * FROM chat_messages
       WHERE game_id = ?
       ORDER BY datetime(created_at) ASC, id ASC`
    )
    .bind(id)
    .all();

  const rows = (results || []).map((r) => ({
    ...r,
    // server returns camel-ish alias your UI already uses
    created_date: r.created_at,
    // parse participants to array if present
    thread_participants: r.thread_participants
      ? (() => { try { const a = JSON.parse(r.thread_participants); return Array.isArray(a) ? a : null; } catch { return null; } })()
      : null,
  }));

  return json(rows);
}

export async function onRequestPost({ request, params, env }) {
  const { id } = params;

  if (!env.DB) return json({ error: "DB not configured" }, 503);

  const body = await request.json().catch(() => ({}));
  const thread_id = normalizeThreadId(body.thread_id);
  const message = (body.message ?? "").toString().trim();

  // sender_email is required; also allow a header fallback commonly used in your app
  const sender_email =
    (body.sender_email && String(body.sender_email)) ||
    request.headers.get("x-player-email") ||
    null;

  const sender_country = body.sender_country ? String(body.sender_country) : null;
  const participantsArr = parseParticipants(body.thread_participants);
  const participantsJson = participantsArr ? JSON.stringify(participantsArr) : null;

  if (!message || !sender_email) {
    return json({ error: "message and sender_email are required" }, 400);
  }

  await ensureChatSchema(env);

  const msgId = newId();

  // Explicit column list to be robust to future schema evolution.
  await env.DB.prepare(
    `INSERT INTO chat_messages
      (id, game_id, thread_id, thread_participants, message, sender_email, sender_country)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    msgId,
    id,
    thread_id,
    participantsJson,
    message,
    sender_email,
    sender_country
  ).run();

  // Return the inserted row
  const { results } = await env.DB
    .prepare(`SELECT * FROM chat_messages WHERE id = ?`)
    .bind(msgId)
    .all();

  const row = results?.[0] || {
    id: msgId,
    game_id: id,
    thread_id,
    thread_participants: participantsJson,
    message,
    sender_email,
    sender_country,
    created_at: new Date().toISOString(),
  };

  return json({
    ...row,
    created_date: row.created_at,
    thread_participants: row.thread_participants
      ? (() => { try { const a = JSON.parse(row.thread_participants); return Array.isArray(a) ? a : null; } catch { return null; } })()
      : null,
  }, 201);
}
