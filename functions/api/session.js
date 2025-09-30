export async function onRequestPost({ request, env }) {
  const { name } = await request.json();
  const incoming = request.headers.get("x-player-id");
  const id = incoming || crypto.randomUUID();
  const email = `${id}@players.local`;      // used by your UI for identity
  const full_name = (name || "Diplomat").toString().trim();

  // upsert
  await env.DB.prepare(
    "INSERT OR IGNORE INTO players (id, email, full_name) VALUES (?, ?, ?)"
  ).bind(id, email, full_name).run();

  await env.DB.prepare(
    "UPDATE players SET full_name = ? WHERE id = ?"
  ).bind(full_name, id).run();

  return new Response(JSON.stringify({ id, email, full_name, role: "player" }), {
    headers: { "Content-Type": "application/json" },
  });
}
