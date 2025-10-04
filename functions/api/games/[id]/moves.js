// functions/api/games/[id]/moves.js
import { json } from "../../../_utils.js";

async function ensureMovesTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS game_moves (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      turn INTEGER NOT NULL,
      phase TEXT NOT NULL,
      player_email TEXT NOT NULL,
      orders TEXT, -- JSON
      is_finalized INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_moves_game_phase ON game_moves(game_id, turn, phase)`
  ).run();
}

export async function onRequestGet({ params, env }) {
  const { id } = params;
  await ensureMovesTable(env);

  const r = await env.DB.prepare(
    `SELECT * FROM game_moves WHERE game_id = ? ORDER BY created_at DESC`
  ).bind(id).all();

  const results = (r.results || []).map((row) => ({
    ...row,
    orders: row.orders ? JSON.parse(row.orders) : [],
    is_finalized: Boolean(Number(row.is_finalized || 0)),
  }));

  return json(results);
}

export async function onRequestPost({ request, params, env }) {
  const { id } = params;
  await ensureMovesTable(env);

  const payload = await request.json().catch(() => ({}));
  const {
    player_email,
    turn,
    phase,
    orders = [],
    is_finalized = false,
  } = payload;

  const recId = globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

  await env.DB.prepare(
    `INSERT INTO game_moves (id, game_id, turn, phase, player_email, orders, is_finalized)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      recId,
      id,
      Number(turn) || 0,
      String(phase || "orders"),
      String(player_email || ""),
      JSON.stringify(orders),
      is_finalized ? 1 : 0
    )
    .run();

  return json({ id: recId });
}
