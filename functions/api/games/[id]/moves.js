export async function onRequestGet({ request, params, env }) {
  const { id } = params;
  const url = new URL(request.url);
  const q = Object.fromEntries(url.searchParams);

  const clauses = ["game_id = ?"];
  const binds = [id];

  for (const k of ["turn_number","phase","source_phase","submitted","player_email","email","country"]) {
    if (q[k] !== undefined) {
      clauses.push(`${k.replace("player_email","email")} = ?`);
      binds.push(q[k]);
    }
  }

  const { results } = await env.DB.prepare(
    `SELECT * FROM game_moves WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`
  ).bind(...binds).all();

  return Response.json(results.map(r => ({ ...r, orders: r.orders ? JSON.parse(r.orders) : [] })));
}

export async function onRequestPost({ request, params, env }) {
  const { id } = params; // game id
  const body = await request.json();
  const moveId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO game_moves (id, game_id, email, country, turn_number, phase, source_phase, orders, submitted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    moveId, id, body.email || null, body.country || null, body.turn_number, body.phase,
    body.source_phase || null, JSON.stringify(body.orders || []), body.submitted ? 1 : 0
  ).run();

  const { results } = await env.DB.prepare("SELECT * FROM game_moves WHERE id = ?").bind(moveId).all();
  const row = results[0];
  return Response.json({ ...row, orders: row.orders ? JSON.parse(row.orders) : [] }, { status: 201 });
}
