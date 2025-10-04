import { json } from "../../_utils.js";

// Optional (handy for debugging)
// GET /api/moves/:id  -> one move row
export async function onRequestGet({ params, env }) {
  if (!env.DB) return json({ error: "DB not configured" }, 503);
  const { id } = params;

  const { results } = await env.DB.prepare("SELECT * FROM game_moves WHERE id = ?").bind(id).all();
  const row = results?.[0];
  if (!row) return new Response("Not found", { status: 404 });

  return json({
    ...row,
    orders: row.orders
      ? (typeof row.orders === "string" ? JSON.parse(row.orders) : row.orders)
      : [],
    submitted: Number(row.submitted) ? 1 : 0,
  });
}

// PATCH /api/moves/:id  -> update a move row
export async function onRequestPatch({ request, params, env }) {
  if (!env.DB) return json({ error: "DB not configured" }, 503);

  const { id } = params;
  const patch = await request.json().catch(() => ({}));

  const { results } = await env.DB.prepare("SELECT * FROM game_moves WHERE id = ?").bind(id).all();
  if (!results?.[0]) return new Response("Not found", { status: 404 });

  const cur = results[0];

  // --- Fix 1: preserve existing JSON string as-is; stringify only when new orders provided ---
  let nextOrdersStr;
  if (patch.orders === undefined || patch.orders === null) {
    // Keep whatever is already in DB (string or null/array)
    nextOrdersStr =
      typeof cur.orders === "string"
        ? cur.orders
        : JSON.stringify(cur.orders || []);
  } else {
    // Caller provided new orders (array/object) -> store as JSON string
    nextOrdersStr = JSON.stringify(patch.orders);
  }

  // --- Fix 2: normalize submitted to 0/1 deterministically ---
  const normalize01 = (v, fallback) => {
    if (v === 1 || v === "1" || v === true) return 1;
    if (v === 0 || v === "0" || v === false) return 0;
    return fallback;
  };
  const submitted = normalize01(patch.submitted, Number(cur.submitted) ? 1 : 0);

  await env.DB.prepare(
    `UPDATE game_moves
       SET email = ?,
           country = ?,
           turn_number = ?,
           phase = ?,
           source_phase = ?,
           orders = ?,
           submitted = ?
     WHERE id = ?`
  ).bind(
    patch.email ?? cur.email,
    patch.country ?? cur.country,
    (typeof patch.turn_number === "number" ? patch.turn_number : Number(cur.turn_number)) || 0,
    patch.phase ?? cur.phase,
    patch.source_phase ?? cur.source_phase,
    nextOrdersStr,
    submitted,
    id
  ).run();

  const { results: r2 } = await env.DB.prepare("SELECT * FROM game_moves WHERE id = ?").bind(id).all();
  const row = r2?.[0];

  return json({
    ...row,
    orders: row?.orders
      ? (typeof row.orders === "string" ? JSON.parse(row.orders) : row.orders)
      : [],
    submitted: Number(row?.submitted) ? 1 : 0,
  });
}
