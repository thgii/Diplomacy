export async function onRequestPatch({ request, params, env }) {
  const { id } = params;
  const patch = await request.json();

  const { results } = await env.DB.prepare("SELECT * FROM game_moves WHERE id = ?").bind(id).all();
  if (!results[0]) return new Response("Not found", { status: 404 });

  const cur = results[0];
  const merged = {
    ...cur,
    ...patch,
    orders: JSON.stringify(patch.orders ?? (cur.orders || "[]")),
  };

  await env.DB.prepare(
    `UPDATE game_moves SET email=?, country=?, turn_number=?, phase=?, source_phase=?,
     orders=?, submitted=? WHERE id=?`
  ).bind(
    merged.email, merged.country, merged.turn_number, merged.phase, merged.source_phase || null,
    merged.orders, patch.submitted ? 1 : cur.submitted, id
  ).run();

  const { results: res2 } = await env.DB.prepare("SELECT * FROM game_moves WHERE id = ?").bind(id).all();
  const row = res2[0];
  return Response.json({ ...row, orders: row.orders ? JSON.parse(row.orders) : [] });
}
