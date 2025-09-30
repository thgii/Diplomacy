import { parseGame, json } from "../../_utils";

export async function onRequestGet({ params, env }) {
  const { id } = params;
  const { results } = await env.DB.prepare("SELECT * FROM games WHERE id = ?").bind(id).all();
  const game = results[0] ? parseGame(results[0]) : null;
  return game ? json(game) : new Response("Not found", { status: 404 });
}

export async function onRequestPatch({ request, params, env }) {
  const { id } = params;
  const patch = await request.json().catch(() => ({}));

  const { results } = await env.DB.prepare("SELECT * FROM games WHERE id = ?").bind(id).all();
  if (!results[0]) return new Response("Not found", { status: 404 });
  const current = parseGame(results[0]);

  const merged = {
    ...current,
    ...patch,
    players: patch.players ?? current.players,
    game_state: patch.game_state ?? current.game_state,
  };

  await env.DB.prepare(
    `UPDATE games SET
      name = ?, host_email = ?, status = ?, max_players = ?, turn_length_hours = ?,
      retreat_length_hours = ?, random_assignment = ?, players = ?, current_turn = ?,
      current_phase = ?, game_state = ?, phase_deadline = ?
     WHERE id = ?`
  ).bind(
    merged.name, merged.host_email, merged.status, merged.max_players, merged.turn_length_hours,
    merged.retreat_length_hours, merged.random_assignment ? 1 : 0,
    JSON.stringify(merged.players || []), merged.current_turn, merged.current_phase,
    JSON.stringify(merged.game_state || null), merged.phase_deadline || null, id
  ).run();

  return json(merged);
}

export async function onRequestDelete({ params, env }) {
  const { id } = params;
  await env.DB.prepare("DELETE FROM games WHERE id = ?").bind(id).run();
  return new Response(null, { status: 204 });
}
