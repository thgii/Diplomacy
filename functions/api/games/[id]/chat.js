// functions/api/games/[id]/chat.js
import { json } from "../../../_utils.js";

export async function onRequestGet({ params, env }) {
  const { id } = params;

  if (!env.DB) return json([]);

  // Ensure table exists (idempotent)
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      thread_id TEXT,
      thread_participants TEXT,           -- JSON array of emails
      message TEXT,
      sender_email TEXT,
      sender_country TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const { results } = await env.DB
    .prepare("SELECT * FROM chat_messages WHERE game_id = ? ORDER BY datetime(created_at) ASC, id ASC")
    .bind(id)
    .all();

  // Parse JSON fields
  const rows = (results || []).map(r => ({
    ...r,
    thread_participants: r.thread_participants ? JSON.parse(r.thread_participants) : null,
    created_date: r.created_at, // keep a camel-ish alias the UI already consumes
  }));

  return json(rows);
}

export async function onRequestPost({ request, params, env }) {
  const { id } = params;
  if (!env.DB) return json({ error: "DB unavailable" }, 500);

  const body = await request.json().catch(() => ({}));
  const {
    thread_id = "public",
    thread_participants = null, // array of emails or null for public
    message = "",
    sender_email = "",
    sender_country = null,
  } = body || {};

  if (!message || !sender_email) {
    return json({ error: "message and sender_email are required" }, 400);
  }

  // Ensure table exists
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      thread_id TEXT,
      thread_participants TEXT,
      message TEXT,
      sender_email TEXT,
      sender_country TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // Basic id
  const msgId = (Date.now().toString(36) + Math.random().toString(36).slice(2));

  // Normalize participants: null for public, JSON for private
  const participantsJson = Array.isArray(thread_participants) && thread_id !== "public"
    ? JSON.stringify([...new Set(thread_participants)].sort())
    : null;

  await env.DB
    .prepare(
      `INSERT INTO chat_messages
        (id, game_id, thread_id, thread_participants, message, sender_email, sender_country)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(msgId, id, thread_id || "public", participantsJson, message, sender_email, sender_country)
    .run();

  const { results } = await env.DB
    .prepare("SELECT * FROM chat_messages WHERE id = ?")
    .bind(msgId)
    .all();

  const row = results?.[0] || {
    id: msgId,
    game_id: id,
    thread_id: thread_id || "public",
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
