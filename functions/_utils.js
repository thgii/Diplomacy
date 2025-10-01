export function parseGame(row) {
  if (!row) return null;
  return {
    ...row,
    players: row.players ? JSON.parse(row.players) : [],
    game_state: row.game_state ? JSON.parse(row.game_state) : null,
  };
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}
