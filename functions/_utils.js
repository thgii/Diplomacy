export function parseGame(row) {
  if (!row) return null;
  return {
    ...row,
    auto_adjudicate: row.auto_adjudicate ? Boolean(Number(row.auto_adjudicate)) : false,
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

// ETag helper for optimistic concurrency (quoted string per HTTP spec)
export function etagFromVersion(v) {
  const n = Number(v);
  const safe = Number.isFinite(n) ? n : 0;
  return `"v${safe}"`;
}

