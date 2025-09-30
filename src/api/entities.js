// src/api/entities.js
import { http, getPlayer, setPlayer } from "./http";

// --- Simple "account" using only a name & a generated id ---
export const User = {
  async me() {
    return getPlayer(); // { id, email, full_name, role }
  },
  async login() {
    const name = prompt("Enter a display name (friends will see this):")?.trim() || "Diplomat";
    const session = await http("/session", { method: "POST", body: JSON.stringify({ name }) });
    setPlayer(session);
    return session;
  },
  async logout() {
    localStorage.removeItem("player");
  },
};

// --- Games ---
export const Game = {
  async list() {
    return http(`/games`); // newest first
  },
  async get(id) {
    return http(`/games/${id}`);
  },
  async create(data) {
    return http(`/games`, { method: "POST", body: JSON.stringify(data) });
  },
  async update(id, patch) {
    return http(`/games/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async delete(id) {
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
