// functions/api/games/[id]/join.js
import { parseGame, json } from "../../../_utils.js";

export async function onRequestPost({ request, params, env }) {
  const { id } = params;

  const caller =
    request.headers.get("x-player-id") ||
    (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

  const email = `${caller}@players.local`;
  const now = new Date().toISOString();

  const { results } = await env.DB.prepare("SELECT * FROM games WHERE id = ?").bind(id).all();
  if (!results[0]) return new Response("Not found", { status: 404 });
  const game = parseGame(results[0]);

  const already = (game.players || []).some((p) => p.email === email);
  if (!already) {
    game.players = [...(game.players || []), { email, country: null, is_host: false, joined_at: now }];
    await env.DB.prepare("UPDATE games SET players = ? WHERE id = ?")
      .bind(JSON.stringify(game.players), id)
      .run();
  }
  return json(game);
}
