export function parseGame(row) {
  if (!row) return null;
  return {
    ...row,
    players: row.players ? JSON.parse(row.players) : [],
    game_state: row.game_state ? JSON.parse(row.game_state) : null,
  };
}
