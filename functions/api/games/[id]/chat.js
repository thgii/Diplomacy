// functions/api/games/[id]/chat.js

export async function onRequestGet({ params, env }) {
  const { id } = params;

  // If the D1 binding isn't configured (e.g., preview env), fail safe.
  if (!env.DB) return Response.json([]);

  // Ensure table exists (idempotent)
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      thread_id TEXT,
      message TEXT,
      sender_email TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();

  const { results } = await env.DB.prepare(
    "SELECT * FROM chat_messages WHERE game_id = ? ORDER BY created_at ASC"
  ).bind(id).all();

  return Response.json(results || []);
}

export async function onRequestPost({ request, params, env }) {
  const { id } = params;

  // If there is no DB bound, return a clear 503 so the UI can show a toast
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "DB not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse body safely
  const body = await request.json().catch(() => ({}));
  const thread = (body.thread_id || "public").toString();
  const message = (body.message || "").toString();
  const sender = body.sender_email ? String(body.sender_email) : null;

  // Ensure table exists (idempotent)
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      thread_id TEXT,
      message TEXT,
      sender_email TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();

  // Generate an id
  const msgId =
    (globalThis.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  // Insert the message
  await env.DB.prepare(
    "INSERT INTO chat_messages (id, game_id, thread_id, message, sender_email) VALUES (?, ?, ?, ?, ?)"
  ).bind(msgId, id, thread, message, sender).run();

  // Read back the inserted row
  const { results } = await env.DB.prepare(
    "SELECT * FROM chat_messages WHERE id = ?"
  ).bind(msgId).all();

  return Response.json(results?.[0] || { id: msgId, game_id: id, thread_id: thread, message, sender_email: sender }, { status: 201 });
}
