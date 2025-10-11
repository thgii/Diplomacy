import { parseGame, json, etagFromVersion } from "../../_utils.js";

export async function onRequestGet({ params, env, request }) {
  const { id } = params;
  const { results } = await env.DB.prepare("SELECT * FROM games WHERE id = ?").bind(id).all();
  const game = results[0] ? parseGame(results[0]) : null;
  if (!game) return new Response("Not found", { status: 404 });

  // Send ETag so clients can do conditional writes
  const etag = etagFromVersion(game.version);
  // Handle If-None-Match for cheap cache validation (optional)
  if (request.headers.get("If-None-Match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }
  return json(game, 200, { ETag: etag });
}

export async function onRequestPatch({ request, params, env }) {
  const { id } = params;
  const patch = await request.json().catch(() => ({}));

  const { results } = await env.DB.prepare("SELECT * FROM games WHERE id = ?").bind(id).all();
  if (!results[0]) return new Response("Not found", { status: 404 });
  const current = parseGame(results[0]);

  // ---------- Reject "going backwards" in time ----------
  if (typeof patch.current_turn === "number" && patch.current_turn < current.current_turn) {
    return new Response("Stale turn", { status: 409 });
  }
  if (
    patch.current_turn === current.current_turn &&
    typeof patch.current_phase === "string" &&
    patch.current_phase !== current.current_phase
  ) {
    // If you want stricter ordering, implement a comparePhase() here;
    // for now, block any mismatch within same turn.
    return new Response("Stale phase", { status: 409 });
  }

  // ---------- Optimistic concurrency via ETag or version field ----------
  const ifMatch = request.headers.get("If-Match");
  const clientVersion = Number.isFinite(Number(patch.version)) ? Number(patch.version) : current.version;

  // If client sent If-Match, verify against current server version
  if (ifMatch && ifMatch !== etagFromVersion(current.version)) {
    return new Response("Version mismatch", { status: 409 });
  }
  // Also verify the numeric version if provided in body
  if (clientVersion !== current.version) {
    return new Response("Version mismatch", { status: 409 });
  }

  // ---------- Merge (keep your existing shape) ----------
  const merged = {
    ...current,
    ...patch,
    players: patch.players ?? current.players,
    game_state: patch.game_state ?? current.game_state,
  };

  // ---------- Atomic UPDATE guarded by version ----------
  const res = await env.DB.prepare(
    `UPDATE games SET
      name = ?, host_email = ?, status = ?, max_players = ?, turn_length_hours = ?,
      retreat_length_hours = ?, random_assignment = ?, players = ?, current_turn = ?,
      current_phase = ?, game_state = ?, phase_deadline = ?, auto_adjudicate = ?,
      version = version + 1
     WHERE id = ? AND version = ?`
  ).bind(
    merged.name,
    merged.host_email,
    merged.status,
    merged.max_players,
    merged.turn_length_hours,
    merged.retreat_length_hours,
    merged.random_assignment ? 1 : 0,
    JSON.stringify(merged.players || []),
    merged.current_turn,
    merged.current_phase,
    JSON.stringify(merged.game_state || null),
    merged.phase_deadline || null,
    merged.auto_adjudicate ? 1 : 0,
    id,
    current.version
  ).run();

  if (res.changes !== 1) {
    // Someone else updated first → tell client to refetch
    return new Response("Write conflict", { status: 409 });
  }

  // Re-read to return updated version & ETag
  const { results: r2 } = await env.DB.prepare("SELECT * FROM games WHERE id = ?").bind(id).all();
  const updated = parseGame(r2[0]);
  return json(updated, 200, { ETag: etagFromVersion(updated.version) });
}

export async function onRequestDelete({ params, env }) {
  const { id } = params;
  await env.DB.prepare("DELETE FROM games WHERE id = ?").bind(id).run();
  return new Response(null, { status: 204 });
}
