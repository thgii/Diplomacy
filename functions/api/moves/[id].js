import { json } from "../../_utils.js";

export async function onRequestPatch({ request, params, env }) {
  if (!env.DB) return json({ error: "DB not configured" }, 503);

  const { id } = params;
  const patch = await request.json().catch(() => ({}));

  const { results } = await env.DB.prepare("SELECT * FROM game_moves WHERE id = ?").bind(id).all();
  if (!results[0]) return new Response("Not found", { status: 404 });
  const cur = results[0];

  // Guard: only allow edits for the game's current turn/phase
  const { results: g } = await env.DB
    .prepare("SELECT current_turn, current_phase FROM games WHERE id = ?")
    .bind(cur.game_id)
    .all();
  if (!g[0]) return new Response("Game not found", { status: 404 });

  const serverTurn = g[0].current_turn;
  const serverPhase = g[0].current_phase;

  // Determine what this edit is targeting
  const turn = typeof patch.turn_number === "number" ? patch.turn_number : cur.turn_number;
  const phase = typeof patch.phase === "string" ? patch.phase : cur.phase;

  if (turn !== serverTurn || phase !== serverPhase) {
    return new Response("Orders not accepted for stale phase", { status: 409 });
  }

  const mergedOrders = JSON.stringify(patch.orders ?? (cur.orders || "[]"));
  const submitted =
    typeof patch.submitted === "number"
      ? patch.submitted
      : (typeof patch.submitted === "boolean" ? (patch.submitted ? 1 : 0) : cur.submitted);

  await env.DB.prepare(
    `UPDATE game_moves SET email=?, country=?, turn_number=?, phase=?, source_phase=?, orders=?, submitted=? WHERE id=?`
  ).bind(
    patch.email ?? cur.email,
    patch.country ?? cur.country,
    turn,
    phase,
    patch.source_phase ?? cur.source_phase,
    mergedOrders,
    submitted,
    id
  ).run();

  const { results: r2 } = await env.DB.prepare("SELECT * FROM game_moves WHERE id = ?").bind(id).all();
  const row = r2[0];
  return json({ ...row, orders: row.orders ? JSON.parse(row.orders) : [] });
}
