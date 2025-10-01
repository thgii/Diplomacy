// src/api/entities.js
import { http as httpRequest, getPlayer, setPlayer } from "./http";

/* ========================= User ========================= */
export const User = {
  async me() {
    try {
      const res = await httpRequest("/session", { method: "GET" });
      if (res && res.id) {
        setPlayer(res);
        return res;
      }
    } catch {
      setPlayer(null); // clear stale local if cookie/session invalid
    }
    return getPlayer();
  },

  async login(nickname, passcode) {
    const payload = { nickname };
    if (passcode) payload.passcode = passcode;

    try {
      const session = await httpRequest("/session", {
        method: "POST",
        body: payload, // auto-stringified by http()
      });
      setPlayer(session);
      return session;
    } catch (e) {
      let msg = "Sign-in failed.";
      if (e?.status === 401) {
        const apiErr = e?.body?.error || e?.body?.message || "Unauthorized";
        msg = `Sign-in failed: ${apiErr}`;
      } else if (e?.body?.error || e?.body?.message) {
        msg = `Sign-in failed: ${e.body.error || e.body.message}`;
      }
      const err = new Error(msg);
      err.cause = e;
      throw err;
    }
  },

  async logout() {
    try {
      await httpRequest("/session", { method: "DELETE" });
    } finally {
      setPlayer(null);
    }
  },
};

/* ========================= Game ========================= */
export const Game = {
  async get(id) {
    if (!id) throw new Error("Game.get: missing id");
    return httpRequest(`/games/${encodeURIComponent(id)}`);
  },

  async list() {
    try {
      const r = await httpRequest("/games");
      return Array.isArray(r) ? r : [];
    } catch (e) {
      console.error("Game.list failed:", e);
      return [];
    }
  },

  async create(data) {
    const payload = {
      name: data?.name ?? data?.title ?? "New Game",
      max_players: toNum(data?.max_players ?? data?.maxPlayers, 7),
      turn_length_hours: toNum(data?.turn_length_hours ?? data?.turnLengthHours, 24),
      retreat_length_hours: toNum(data?.retreat_length_hours ?? data?.retreatLengthHours, 24),
      random_assignment: !!(data?.random_assignment ?? data?.randomAssignment),
      selectedCountry: data?.selectedCountry ?? null,
      units: data?.units,
      game_state: data?.game_state,
      host_email: data?.host_email,
      players: data?.players,
      auto_adjudicate: data?.auto_adjudicate,
      draw_votes: data?.draw_votes,
      winners: data?.winners,
      phase_deadline: data?.phase_deadline ?? null,
    };
    return httpRequest("/games", { method: "POST", body: payload });
  },

  async update(id, patch) {
    if (!id) throw new Error("Game.update: missing id");
    return httpRequest(`/games/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    });
  },

  async delete(id) {
    if (!id) throw new Error("Game.delete: missing id");
    return httpRequest(`/games/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async filter(q = {}) {
    const qs = new URLSearchParams(q).toString();
    return httpRequest(`/games${qs ? `?${qs}` : ""}`);
  },
};

/* ========================= GameMove ========================= */
export const GameMove = {
  async filter(q) {
    const { game_id, ...rest } = q || {};
    if (!game_id) throw new Error("GameMove.filter: missing game_id");
    const qs = new URLSearchParams(rest).toString();
    return httpRequest(`/games/${encodeURIComponent(game_id)}/moves${qs ? `?${qs}` : ""}`);
  },

  async create(data) {
    const { game_id, ...payload } = data || {};
    if (!game_id) throw new Error("GameMove.create: missing game_id");
    return httpRequest(`/games/${encodeURIComponent(game_id)}/moves`, {
      method: "POST",
      body: payload,
    });
  },

  async update(id, patch) {
    if (!id) throw new Error("GameMove.update: missing id");
    return httpRequest(`/moves/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    });
  },
};

/* ========================= ChatMessage ========================= */
export const ChatMessage = {
  // Supports optional sort & limit: ChatMessage.filter({ game_id }, "-created_date", 1)
  async filter(q, sort, limit) {
    const { game_id } = q || {};
    if (!game_id) throw new Error("ChatMessage.filter: missing game_id");
    const params = new URLSearchParams();
    if (sort) params.set("sort", sort);
    if (Number.isFinite(limit)) params.set("limit", String(limit));
    const qs = params.toString();
    return httpRequest(`/games/${encodeURIComponent(game_id)}/chat${qs ? `?${qs}` : ""}`);
  },

  async create(data) {
    const { game_id, ...payload } = data || {};
    if (!game_id) throw new Error("ChatMessage.create: missing game_id");
    return httpRequest(`/games/${encodeURIComponent(game_id)}/chat`, {
      method: "POST",
      body: payload,
    });
  },
};

/* ========================= helpers ========================= */
function toNum(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
