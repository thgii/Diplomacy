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
      body: JSON.stringify(payload),
    });
    // If server returns passcode on first create, keep it in memory for showing,
    // but don't persist it to localStorage.
    const { passcode: maybePass } = session || {};
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
  async list() {
    try {
      const r = await http("/games");
      return Array.isArray(r) ? r : [];
    } catch (e) {
      console.error("Game.list failed:", e);
      return [];
    }
  },

  async get(id) {
    return http(`/games/${id}`);
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
    };
    return http("/games", { method: "POST", body: JSON.stringify(payload) });
  },

  async update(id, patch) {
    return http(`/games/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async delete(id) {
    return http(`/games/${id}`, { method: "DELETE" });
  },

  // FIX A1: If caller provides an id (or game_id), fetch that single game and return [game]
  async filter(q = {}) {
    const id = q?.id ?? q?.game_id;
    if (id) {
      const one = await http(`/games/${id}`);
      return one ? [one] : [];
    }
    const qs = new URLSearchParams(q).toString();
    return http(`/games${qs ? `?${qs}` : ""}`);
  },
};

// ---------- GameMove ----------
export const GameMove = {
  async filter(q) {
    const { game_id, ...rest } = q || {};
    const qs = new URLSearchParams(rest).toString();
    return http(`/games/${game_id}/moves${qs ? `?${qs}` : ""}`);
  },

  async create(data) {
    const { game_id, ...payload } = data || {};
    return http(`/games/${game_id}/moves`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async update(id, patch) {
    return http(`/moves/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
};

// ---------- ChatMessage ----------
export const ChatMessage = {
  async filter(q) {
    const { game_id } = q || {};
    return http(`/games/${game_id}/chat`);
  },

  async create(data) {
    const { game_id, ...payload } = data || {};
    return http(`/games/${game_id}/chat`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

// ---------- helpers ----------
function toNum(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
