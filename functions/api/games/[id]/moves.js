import { json } from "../../../_utils.js";

export async function onRequestGet({ request, params, env }) {
  const { id } = params;
  const url = new URL(request.url);
  const q = Object.fromEntries(url.searchParams);

  const clauses = ["game_id = ?"];
  const binds = [id];
  const keys = ["turn_number","phase","source_phase","submitted","player_email","email","country"];

  for (const k of keys) {
    if (q[k] !== undefined) {
      const col = k === "player_email" ? "email" : k;
      clauses.push(`${col} = ?`);
      binds.push(q[k]);
    }
  }

  const { results } = await env.DB.prepare(
    `SELECT * FROM game_moves WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`
  ).bind(...binds).all();

  return json(results.map(r => ({ ...r, orders: r.orders ? JSON.parse(r.orders) : [] })));
}

export async function onRequestPost({ request, params, env }) {
  const { id } = params; // game id
  const body = await request.json().catch(() => ({}));
  const moveId = (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS game_moves (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      email TEXT,
      country TEXT,
      turn_number INTEGER,
      phase TEXT,
      source_phase TEXT,
      orders TEXT,
      submitted INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();

  await env.DB.prepare(
    `INSERT INTO game_moves (id, game_id, email, country, turn_number, phase, source_phase, orders, submitted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    moveId, id, body.email || null, body.country || null, body.turn_number, body.phase,
    body.source_phase || null, JSON.stringify(body.orders || []), body.submitted ? 1 : 0
  ).run();

  const { results } = await env.DB.prepare("SELECT * FROM game_moves WHERE id = ?").bind(moveId).all();
  const row = results[0];
  return json({ ...row, orders: row.orders ? JSON.parse(row.orders) : [] }, 201);
}
