import { parseGame, json } from "../../_utils";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM games ORDER BY created_at DESC"
  ).all();
  return json(results.map(parseGame));
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  const id = (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

  const caller = "anon"; // we’ll identify by header on join; host_email kept for UI
  const host_email = `${caller}@players.local`;

  const players = [{
    email: host_email,
    country: body.selectedCountry || null,
    is_host: true,
    joined_at: now
  }];

  const game_state = body.game_state || { units: body.units || [], retreats_required: [] };

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host_email TEXT,
      status TEXT NOT NULL,
      max_players INTEGER,
      turn_length_hours INTEGER,
      retreat_length_hours INTEGER,
      random_assignment INTEGER,
      players TEXT,
      current_turn INTEGER,
      current_phase TEXT,
      game_state TEXT,
      phase_deadline TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();

  await env.DB.prepare(
    `INSERT INTO games
     (id, name, host_email, status, max_players, turn_length_hours, retreat_length_hours,
      random_assignment, players, current_turn, current_phase, game_state, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.name || "New Game",
    host_email,
    "waiting",
    body.max_players ?? 7,
    body.turn_length_hours ?? 24,
    body.retreat_length_hours ?? 24,
    body.random_assignment ? 1 : 0,
    JSON.stringify(players),
    1,
    "spring",
    JSON.stringify(game_state),
    now
  ).run();

  const { results } = await env.DB.prepare("SELECT * FROM games WHERE id = ?").bind(id).all();
  return json(results.map(parseGame)[0], 201);
}
