// functions/api/games/index.js
import { parseGame, json } from "../../_utils.js";

export async function onRequestGet({ env }) {
  if (!env.DB) return json([]); // safe fallback for previews
  await ensureGamesTable(env);
  const { results } = await env.DB.prepare(
    "SELECT * FROM games ORDER BY created_at DESC"
  ).all();
  return json(results.map(parseGame));
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "DB not configured" }, 503);

  // Parse body safely
  const body = await request.json().catch(() => ({}));

  // Normalize incoming fields from various UIs
  const now = new Date().toISOString();
  const id =
    (globalThis.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  // Identify host by header (set by http.js from localStorage)
  const caller = request.headers.get("x-player-id") || "anon";
  const host_email = `${caller}@players.local`;

  const name = (body.name ?? body.title ?? "New Game").toString();
  const max_players = num(body.max_players ?? body.maxPlayers ?? 7);
  const turn_length_hours = num(body.turn_length_hours ?? body.turnLengthHours ?? 24);
  const retreat_length_hours = num(body.retreat_length_hours ?? body.retreatLengthHours ?? 24);
  const random_assignment = bool(body.random_assignment ?? body.randomAssignment ?? false);

  // Initial players/ state (keep it simple; UI can PATCH later)
  const players = [{
    email: host_email,
    country: body.selectedCountry || null,
    is_host: true,
    joined_at: now
  }];

  const game_state = body.game_state || { units: body.units || [], retreats_required: [] };

  await ensureGamesTable(env);

  await env.DB.prepare(
    `INSERT INTO games
     (id, name, host_email, status, max_players, turn_length_hours, retreat_length_hours,
      random_assignment, players, current_turn, current_phase, game_state, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    name,
    host_email,
    "waiting",
    max_players,
    turn_length_hours,
    retreat_length_hours,
    random_assignment ? 1 : 0,
    JSON.stringify(players),
    1,
    "spring",
    JSON.stringify(game_state),
    now
  ).run();

  const { results } = await env.DB.prepare(
    "SELECT * FROM games WHERE id = ?"
  ).bind(id).all();

  return json(results.map(parseGame)[0], 201);
}

// Helpers
async function ensureGamesTable(env) {
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
}

function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function bool(v) { return v === true || v === 1 || v === "1" || v === "true"; }  const players = [{
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
