// src/api/entities.js
import { http, getPlayer, setPlayer } from "./http";

// ---------- User ----------
export const User = {
  async me() {
    // Prefer server session (cookie); fall back to local cache
    try {
      const res = await http("/session", { method: "GET" });
      if (res && res.id) {
        setPlayer(res);
        return res;
      }
    } catch {}
    return getPlayer();
  },

  async login(nickname, passcode) {
    const payload = { nickname };
    if (passcode) payload.passcode = passcode;
    const session = await http("/session", {
      method: "POST",
      body: payload, // http() will JSON.stringify
    });
    setPlayer(session);
    return session; // { id, nickname, ... , passcode? }
  },

  async logout() {
    await http("/session", { method: "DELETE" });
    setPlayer(null);
  },
};

// ---------- Game ----------
export const Game = {
  async get(id) {
    if (!id) throw new Error("Game.get: missing id");
    return http(`/games/${encodeURIComponent(id)}`);
  },

  async list() {
    try {
      const r = await http("/games");
      return Array.isArray(r) ? r : [];
    } catch (e) {
      console.error("Game.list failed:", e);
      return [];
    }
  },

  async create(data) {
    // Normalize field names from your form -> API expects snake_case
    const payload = {
      name: data?.name ?? data?.title ?? "New Game",
      max_players: toNum(data?.max_players ?? data?.maxPlayers, 7),
      turn_length_hours: toNum(data?.turn_length_hours ?? data?.turnLengthHours, 24),
      retreat_length_hours: toNum(data?.retreat_length_hours ?? data?.retreatLengthHours, 24),
      random_assignment: !!(data?.random_assignment ?? data?.randomAssignment),
      selectedCountry: data?.selectedCountry ?? null,
      units: data?.units,
      game_state: data?.game_state,
      host_email: data?.host_email, // preserve if you pass it
      players: data?.players,       // preserve if you pass it
      auto_adjudicate: data?.auto_adjudicate,
      draw_votes: data?.draw_votes,
      winners: data?.winners,
      phase_deadline: data?.phase_deadline ?? null,
    };
    return http("/games", { method: "POST", body: payload });
  },

  async update(id, patch) {
    if (!id) throw new Error("Game.update: missing id");
    return http(`/games/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch, // http() will JSON.stringify
    });
  },

  async delete(id) {
    if (!id) throw new Error("Game.delete: missing id");
    return http(`/games/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async filter(q = {}) {
    const qs = new URLSearchParams(q).toString();
    return http(`/games${qs ? `?${qs}` : ""}`);
  },
};

// ---------- GameMove ----------
export const GameMove = {
  async filter(q) {
    // q: { game_id, turn_number?, phase?, submitted?, source_phase?, player_email? ... }
    const { game_id, ...rest } = q || {};
    if (!game_id) throw new Error("GameMove.filter: missing game_id");
    const qs = new URLSearchParams(rest).toString();
    return http(`/games/${encodeURIComponent(game_id)}/moves${qs ? `?${qs}` : ""}`);
  },

  async create(data) {
    // data: { game_id, player_email, country, turn_number, phase, orders, submitted, source_phase? }
    const { game_id, ...payload } = data || {};
    if (!game_id) throw new Error("GameMove.create: missing game_id");
    return http(`/games/${encodeURIComponent(game_id)}/moves`, {
      method: "POST",
      body: payload,
    });
  },

  async update(id, patch) {
    if (!id) throw new Error("GameMove.update: missing id");
    return http(`/moves/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    });
  },
};

// ---------- ChatMessage ----------
export const ChatMessage = {
  // Support optional sort & limit, since you call filter({ game_id }, "-created_date", 1)
  async filter(q, sort, limit) {
    const { game_id } = q || {};
    if (!game_id) throw new Error("ChatMessage.filter: missing game_id");
    const params = new URLSearchParams();
    if (sort) params.set("sort", sort);
    if (Number.isFinite(limit)) params.set("limit", String(limit));
    const qs = params.toString();
    return http(`/games/${encodeURIComponent(game_id)}/chat${qs ? `?${qs}` : ""}`);
  },

  async create(data) {
    // data: { game_id, thread_id?, thread_participants?, sender_email, sender_country, message }
    const { game_id, ...payload } = data || {};
    if (!game_id) throw new Error("ChatMessage.create: missing game_id");
    return http(`/games/${encodeURIComponent(game_id)}/chat`, {
      method: "POST",
      body: payload,
    });
  },
};

// ---------- helpers ----------
function toNum(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
