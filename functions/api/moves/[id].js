import { json } from "../../_utils.js";

export async function onRequestPatch({ request, params, env }) {
  const { id } = params;
  const patch = await request.json().catch(() => ({}));

  const { results } = await env.DB.prepare("SELECT * FROM game_moves WHERE id = ?").bind(id).all();
  if (!results[0]) return new Response("Not found", { status: 404 });

  const cur = results[0];
  const mergedOrders = JSON.stringify(patch.orders ?? (cur.orders || "[]"));
  const submitted = typeof patch.submitted === "number" ? patch.submitted : cur.submitted;

  await env.DB.prepare(
    `UPDATE game_moves SET email=?, country=?, turn_number=?, phase=?, source_phase=?,
     orders=?, submitted=? WHERE id=?`
  ).bind(
    patch.email ?? cur.email,
    patch.country ?? cur.country,
    patch.turn_number ?? cur.turn_number,
    patch.phase ?? cur.phase,
    patch.source_phase ?? cur.source_phase,
    mergedOrders,
    submitted,
    id
  ).run();

  const { results: r2 } = await env.DB.prepare("SELECT * FROM game_moves WHERE id = ?").bind(id).all();
  const row = r2[0];
  return json({ ...row, orders: row.orders ? JSON.parse(row.orders) : [] });
}
