// src/api/entities.js
import { http, getPlayer, setPlayer } from "./http";

export const User = {
  me() { return getPlayer(); },
  async login(name) {
    const session = await http("/session", { method: "POST", body: JSON.stringify({ name }) });
    setPlayer(session);
    return session;
  },
  logout() { localStorage.removeItem("player"); },
};

export const Game = {
  async list() {
    try {
      const r = await http(`/games`);
      return Array.isArray(r) ? r : [];
    } catch (e) {
      console.error("Game.list failed:", e);
      return [];
    }
  },
  async create(data) {
    // Normalize possible form field names coming from your UI
    const payload = {
      name: data?.name ?? data?.title ?? "New Game",
      max_players: toNum(data?.max_players ?? data?.maxPlayers, 7),
      turn_length_hours: toNum(data?.turn_length_hours ?? data?.turnLengthHours, 24),
      retreat_length_hours: toNum(data?.retreat_length_hours ?? data?.retreatLengthHours, 24),
      random_assignment: !!(data?.random_assignment ?? data?.randomAssignment),
      // pass-throughs if present
      selectedCountry: data?.selectedCountry ?? null,
      units: data?.units,
      game_state: data?.game_state,
    };
    return http(`/games`, { method: "POST", body: JSON.stringify(payload) });
  },
  async get(id) { return http(`/games/${id}`); },
  async update(id, patch) { return http(`/games/${id}`, { method: "PATCH", body: JSON.stringify(patch) }); },
  async delete(id) { return http(`/games/${id}`, { method: "DELETE" }); },
  async filter(q = {}) {
    const qs = new URLSearchParams(q).toString();
    return http(`/games${qs ? `?${qs}` : ""}`);
  },
};

export const GameMove = {
  async filter(q) {
    const { game_id, ...rest } = q || {};
    const qs = new URLSearchParams(rest).toString();
    return http(`/games/${game_id}/moves${qs ? `?${qs}` : ""}`);
  },
  async create(data) {
    const { game_id, ...payload } = data;
    return http(`/games/${game_id}/moves`, { method: "POST", body: JSON.stringify(payload) });
  },
  async update(id, patch) { return http(`/moves/${id}`, { method: "PATCH", body: JSON.stringify(patch) }); },
};

export const ChatMessage = {
  async filter(q) {
    const { game_id } = q || {};
    return http(`/games/${game_id}/chat`);
  },
  async create(data) {
    const { game_id, ...payload } = data;
    return http(`/games/${game_id}/chat`, { method: "POST", body: JSON.stringify(payload) });
  },
};

// helpers
function toNum(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }  async delete(id) {
    return http(`/games/${id}`, { method: "DELETE" });
  },
  // Optional: very light filter to match existing code calling Game.filter()
  async filter(q = {}) {
    // filter by status or host email if provided
    const qs = new URLSearchParams(q).toString();
    return http(`/games${qs ? `?${qs}` : ""}`);
  },
};

// --- Per-turn orders (what your UI calls GameMove) ---
export const GameMove = {
  async filter(q) {
    const { game_id, ...rest } = q || {};
    const qs = new URLSearchParams(rest).toString();
    return http(`/games/${game_id}/moves${qs ? `?${qs}` : ""}`);
  },
  async create(data) {
    const { game_id, ...payload } = data;
    return http(`/games/${game_id}/moves`, { method: "POST", body: JSON.stringify(payload) });
  },
  async update(id, patch) {
    return http(`/moves/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
};

// --- Chat ---
export const ChatMessage = {
  async filter(q) {
    const { game_id } = q || {};
    return http(`/games/${game_id}/chat`);
  },
  async create(data) {
    const { game_id, ...payload } = data;
    return http(`/games/${game_id}/chat`, { method: "POST", body: JSON.stringify(payload) });
  },
};
