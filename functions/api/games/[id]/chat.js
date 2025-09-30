export async function onRequestGet({ params, env }) {
  const { id } = params;
  const { results } = await env.DB.prepare(
    "SELECT * FROM chat_messages WHERE game_id = ? ORDER BY created_at ASC"
  ).bind(id).all();
  return Response.json(results);
}

export async function onRequestPost({ request, params, env }) {
  const { id } = params;
  const body = await request.json();
  const msgId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO chat_messages (id, game_id, thread_id, message, sender_email) VALUES (?, ?, ?, ?, ?)"
  ).bind(msgId, id, body.thread_id || "public", body.message || "", body.sender_email || null).run();

  const { results } = await env.DB.prepare("SELECT * FROM chat_messages WHERE id = ?").bind(msgId).all();
  return Response.json(results[0], { status: 201 });
}
