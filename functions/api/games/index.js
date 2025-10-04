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

  // Ensure schema exists on first write as well
  await ensureGamesTable(env);

  //boolean normalizer
  const bool = (v) => v === true || v === 1 || v === "1" || (typeof v === "string" && v.toLowerCase() === "true") || v === "on";
  const num = (v, d=0) => (v === 0 || v) ? Number(v) : d;


  // Parse and normalize input
  const body = await request.json().catch(() => ({}));
  const name = (body.name || body.title || "New Game").toString().trim();
  const max_players = num(body.max_players ?? body.maxPlayers, 7);
  const turn_length_hours = num(body.turn_length_hours ?? body.turnLengthHours, 24);
  const retreat_length_hours = num(body.retreat_length_hours ?? body.retreatLengthHours, 24);
  const random_assignment = bool(body.random_assignment ?? body.randomAssignment);
  const auto_adjudicate = bool(body.auto_adjudicate ?? body.autoAdjudicate);
  const players = Array.isArray(body.players) ? body.players : [];

  // Always create a well-formed game_state, even if the client omits it
  const normalized_game_state = normalizeGameState(body.game_state);

  // Core defaults for a new game
  const id = globalThis.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const phase_deadline = null;
  const current_turn = 0; // keep your app's convention
  const current_phase = "Spring-1901-Moves"; // keep your app's convention
  const status = "waiting";
  const host_id = (body.host_id || null);
  const host_email = (body.host_email || "").toString() || null;

  await env.DB.prepare(
    `INSERT INTO games (
      id, name, host_email, host_id, status, max_players,
      turn_length_hours, retreat_length_hours, random_assignment,
      players, current_turn, current_phase, game_state, phase_deadline, auto_adjudicate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, name, host_email, host_id, status, max_players,
    turn_length_hours, retreat_length_hours, random_assignment ? 1 : 0,
    JSON.stringify(players), current_turn, current_phase,
    JSON.stringify(normalized_game_state), phase_deadline, auto_adjudicate ? 1 : 0
  ).run();

  const { results } = await env.DB
    .prepare("SELECT * FROM games WHERE id = ?")
    .bind(id)
    .all();

  return json(results.map(parseGame)[0], 201);
}

// Helpers
async function ensureGamesTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host_email TEXT,
      host_id TEXT,
      status TEXT NOT NULL,
      max_players INTEGER,
      turn_length_hours INTEGER,
      retreat_length_hours INTEGER,
      random_assignment INTEGER,
      auto_adjudicate INTEGER DEFAULT 1,
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
function bool(v) { return v === true || v === 1 || v === "1" || v === "true"; }

/**
 * Ensure we always store a well-formed game_state at creation.
 * - Keeps any extra keys the client might send
 * - Guarantees the critical fields exist with correct shapes
 */
function normalizeGameState(gs) {
  const base = {
    units: [],
    supply_centers: {},
    last_turn_results: null,
    pending_retreats: [],
  };

  // If nothing valid provided, return the base
  if (!gs || typeof gs !== "object") return base;

  // Merge while enforcing shapes on critical fields
  return {
    ...base,
    ...gs,
    units: Array.isArray(gs.units) ? gs.units : [],
    supply_centers: (gs.supply_centers && typeof gs.supply_centers === "object") ? gs.supply_centers : {},
    last_turn_results: gs.last_turn_results ?? null,
    pending_retreats: Array.isArray(gs.pending_retreats) ? gs.pending_retreats : [],
  };
}
