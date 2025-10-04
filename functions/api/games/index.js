// functions/api/games/index.js
import { parseGame, json } from "../../_utils.js";

export async function onRequestGet({ env }) {
  try {
    if (!env.DB || !env.DB.prepare) {
      // In Preview without bindings, return empty list rather than crash
      return json([]);
    }

    await ensureGamesTable(env);

    const { results } = await env.DB
      .prepare(`SELECT * FROM games ORDER BY created_at DESC`)
      .all();

    return json((results || []).map(parseGame));
  } catch (err) {
    console.error("GET /api/games failed:", err);
    return json({ error: String(err) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB || !env.DB.prepare) {
      return json({ error: "DB not configured" }, 503);
    }

    await ensureGamesTable(env);

    const body = await request.json().catch(() => ({}));

    const name = String(body.name ?? body.title ?? "New Game").trim();
    const max_players = toInt(body.max_players ?? body.maxPlayers, 7);
    const turn_length_hours = toInt(body.turn_length_hours ?? body.turnLengthHours, 24);
    const retreat_length_hours = toInt(body.retreat_length_hours ?? body.retreatLengthHours, 24);
    const random_assignment = toBool(body.random_assignment ?? body.randomAssignment);
    const auto_adjudicate = toBool(body.auto_adjudicate ?? body.autoAdjudicate);

    const players = Array.isArray(body.players) ? body.players : [];

    const id =
      globalThis.crypto?.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const normalized_game_state = normalizeGameState(body.game_state);

    // Use your current conventions
    const current_turn = 0;
    const current_phase = "Spring-1901-Moves";
    const status = "waiting";
    const phase_deadline = null;

    await env.DB.prepare(
      `INSERT INTO games (
        id, name, host_email, host_id, status, max_players,
        turn_length_hours, retreat_length_hours, random_assignment,
        players, current_turn, current_phase, game_state, phase_deadline, auto_adjudicate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        name,
        (body.host_email || null),
        (body.host_id || null),
        status,
        max_players,
        turn_length_hours,
        retreat_length_hours,
        random_assignment ? 1 : 0,
        JSON.stringify(players),
        current_turn,
        current_phase,
        JSON.stringify(normalized_game_state),
        phase_deadline,
        auto_adjudicate ? 1 : 0
      )
      .run();

    const row = await env.DB
      .prepare(`SELECT * FROM games WHERE id = ?`)
      .bind(id)
      .first();

    return json(parseGame(row), 201);
  } catch (err) {
    console.error("POST /api/games failed:", err);
    return json({ error: String(err) }, 500);
  }
}

/* Helpers */

async function ensureGamesTable(env) {
  // Creates if missing; does NOT alter existing schema
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
      players TEXT,
      current_turn INTEGER,
      current_phase TEXT,
      game_state TEXT,
      phase_deadline TEXT,
      auto_adjudicate INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  ).run();
}

function toInt(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function toBool(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}

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

  if (!gs || typeof gs !== "object") return base;

  return {
    ...base,
    ...gs,
    units: Array.isArray(gs.units) ? gs.units : [],
    supply_centers:
      gs.supply_centers && typeof gs.supply_centers === "object"
        ? gs.supply_centers
        : {},
    last_turn_results: gs.last_turn_results ?? null,
    pending_retreats: Array.isArray(gs.pending_retreats)
      ? gs.pending_retreats
      : [],
  };
}
