import { json } from "../../_utils";

export async function onRequestPost({ request, env }) {
  const payload = await request.json().catch(() => ({}));
  const name = (payload.name || "Diplomat").toString().trim();

  // generate / reuse caller id
  const incoming = request.headers.get("x-player-id");
  const id = incoming || (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  const email = `${id}@players.local`;
  const full_name = name;

  // If DB not bound yet, just return a session (helps first deploys)
  if (!env.DB) return json({ id, email, full_name, role: "player" });

  // ensure table exists (safe, idempotent)
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, email TEXT NOT NULL, full_name TEXT, created_at TEXT DEFAULT (datetime('now')))"
  ).run();

  await env.DB.prepare(
    "INSERT OR IGNORE INTO players (id, email, full_name) VALUES (?, ?, ?)"
  ).bind(id, email, full_name).run();

  await env.DB.prepare(
    "UPDATE players SET full_name = ? WHERE id = ?"
  ).bind(full_name, id).run();

  return json({ id, email, full_name, role: "player" });
}
