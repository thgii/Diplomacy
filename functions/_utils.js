export function parseGame(row) {
  if (!row) return null;
  return {
    ...row,
    players: row.players ? JSON.parse(row.players) : [],
    game_state: row.game_state ? JSON.parse(row.game_state) : null,
  };
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
