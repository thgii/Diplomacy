export function createPageUrl(page: string, params: Record<string, any> = {}) {
  const routes: Record<string, string> = {
    GameBoard: "/gameboard",
    GameLobby: "/gamelobby",
    login: "/login",
    // add others as needed
  };

  const base = routes[page] || `/${page.toLowerCase()}`;
  const qs = new URLSearchParams(params).toString();
  return qs ? `${base}?${qs}` : base;
}
