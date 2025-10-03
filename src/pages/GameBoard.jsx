import React, { useState, useEffect, useCallback, useRef } from "react";
import { Game, ChatMessage, GameMove } from "@/api/entities";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MessageSquare, Users, X, Crown, RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

import DiplomacyMap from "../components/game/DiplomacyMap";
import GameChat from "../components/game/GameChat";
import PlayerPanel from "../components/game/PlayerPanel";
import GameControls from "../components/game/GameControls";
import PhaseTimer from "../components/game/PhaseTimer";
import { adjudicate } from "../components/game/Adjudicator";
import { territories, initialUnits } from "../components/game/mapData";

/* ---------------------------- small helpers ---------------------------- */

// strip client temp suffixes like "-1758730630474"
const stripTempSuffix = (id) => (typeof id === "string" ? id.replace(/-\d{13,}$/, "") : id);
// normalize province casing (e.g., "spa/SC" -> "SPA/sc")
// Map any incoming id (index "2" or string) to the unit's canonical id
const toCanonicalUnitId = (unitId, unitsRef) => {
  const raw = String(unitId);
  const clean = stripTempSuffix(raw);
  if (/^\d+$/.test(clean)) {
    const idx = Number(clean);
    const u = (unitsRef || [])[idx];
    if (u && u.id) return String(u.id).toUpperCase();
  }
  return String(clean).toUpperCase();
};
const normProv = (s) => {
  if (typeof s !== "string") return s;
  const t = s.trim();
  if (!t) return t;
  const [base, coast] = t.split("/");
  return coast ? `${base.toUpperCase()}/${coast.toLowerCase()}` : base.toUpperCase();
};
// base territory without split-coast suffix
const baseProv = (t) => (typeof t === "string" && t.includes("/") ? t.split("/")[0] : t);

// create a readable, unique unit id (stable even with duplicates)
const makeUnitId = (country, originTerritory, type, existingIds = new Set()) => {
  const base = `${String(country).toUpperCase()}-${String(originTerritory).toUpperCase()}-${String(type).toUpperCase()}`;
  if (!existingIds.has(base)) return base;
  let i = 2;
  let candidate = `${base}#${i}`;
  while (existingIds.has(candidate)) {
    i += 1;
    candidate = `${base}#${i}`;
  }
  return candidate;
};

const ensureUniqueUnitIds = (units) => {
  const seen = new Set();
  return (units || []).map((u) => {
    const country = u.country ?? u.nation ?? "UNK";
    const origin = u.home ?? u.origin ?? u.start ?? u.start_territory ?? u.original_territory ?? u.territory ?? "UNK";
    const type = u.type ?? u.unit_type ?? "ARMY";
    let id = (u.id ? String(u.id) : `${country}-${origin}-${type}`).toUpperCase();
    if (seen.has(id)) id = makeUnitId(country, origin, type, seen);
    seen.add(id);
    return { ...u, id };
  });
};

/* ------------------------------- component ------------------------------ */

export default function GameBoard() {
  const [game, setGame] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [units, setUnits] = useState([]);
  const [orders, setOrders] = useState({});
  const [retreatOrders, setRetreatOrders] = useState({});
  const [winterActions, setWinterActions] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSavingOrders, setIsSavingOrders] = useState(false);

  const [showPlayerPanel, setShowPlayerPanel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  const [showLastTurnResults, setShowLastTurnResults] = useState(false);
  const [lastTurnResults, setLastTurnResults] = useState(null);

  const [isResolving, setIsResolving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  const autoAdvanceFiredRef = useRef(false);

  /* -------- effective id wiring: query param -> state -> fallback to game.id -------- */

  // raw query param (do NOT use elsewhere directly)
  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const queryGameId = urlParams.get("gameId");

  // stateful "current" id that everything else uses
  const [effectiveGameId, setEffectiveGameId] = useState(
    queryGameId || (typeof window !== "undefined" ? localStorage.getItem("lastViewedGameId") : null) || null
  );

  // helper for imperative calls
  const effectiveId = useCallback(
    () => effectiveGameId || game?.id || null,
    [effectiveGameId, game?.id]
  );

  // keep effectiveGameId up to date once a game loads
  useEffect(() => {
    if (game?.id) {
      if (!effectiveGameId) setEffectiveGameId(game.id);
      try {
        localStorage.setItem("lastViewedGameId", game.id);
      } catch {}
    }
  }, [game?.id, effectiveGameId]);

  /* ------------------------------ window resize ------------------------------ */

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize(); // initialize on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

// --- Chat unread helpers (localStorage) ---
const lrKey = (gameId, u) => `chat:lastRead:${gameId}:${u?.id ?? u?.email}`;

const getLastReadTs = (gameId, u) => {
  try {
    const raw = localStorage.getItem(lrKey(gameId, u));
    if (!raw) return 0;
    const obj = JSON.parse(raw);
    const vals = Object.values(obj).map(Number).filter(Number.isFinite);
    return vals.length ? Math.max(...vals) : 0;
  } catch { return 0; }
};

const setLastReadTs = (gameId, u, ts) => {
  try {
    const key = lrKey(gameId, u);
    const obj = JSON.parse(localStorage.getItem(key) || "{}");
    obj.__all__ = Math.max(Number(obj.__all__ || 0), Number(ts || 0));
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {}
};

const toMs = (m) => {
  const v = m?.created_date ?? m?.created_at ?? m?.createdAt ?? m?.timestamp ?? m?.time ?? m?.sentAt;
  if (v == null) return 0;
  if (typeof v === "number") return v > 1e12 ? v : v * 1000;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

const isMine = (m, u) =>
  m.user_id === u?.id ||
  m.userId === u?.id ||
  m.sender_id === u?.id ||
  m.sender_email === u?.email ||
  m.email === u?.email;

  /* --------------------------------- chat --------------------------------- */

  const loadChatMessages = useCallback(
  async (gidOverride, userOverride) => {
    try {
      const gid = gidOverride ?? effectiveId();
      const u = userOverride ?? user;
      if (!gid || !u) {
        setChatMessages([]);
        setHasUnreadMessages(false);
        return;
      }


    const msgs = await ChatMessage.filter({ game_id: gid });
    const sorted = [...(msgs || [])].sort((a, b) => toMs(a) - toMs(b));
    setChatMessages(sorted);

    if (!sorted.length) {
      setHasUnreadMessages(false);
      return;
    }

    // Latest message FROM SOMEONE ELSE
    const latestForeignTs = sorted.reduce((acc, m) => {
      return isMine(m, u) ? acc : Math.max(acc, toMs(m));
    }, 0);

    // If there are no foreign messages, there's nothing unread
    if (!latestForeignTs) {
      setHasUnreadMessages(false);
      return;
    }

    const lastReadTs = getLastReadTs(gid, u);

    // Seed baseline on first in-game load (prevents first-load dot)
    // No last-read recorded: treat any foreign message as unread
if (!lastReadTs) {
  setHasUnreadMessages(Boolean(latestForeignTs));
  return;
}


    setHasUnreadMessages(latestForeignTs > lastReadTs);
  } catch (e) {
    console.error("Error loading chat messages:", e);
  }
}, [effectiveId, user?.id, user?.email]);


  const handleOpenChat = () => {
  setShowChat(true);
  setHasUnreadMessages(false);

  const gid = effectiveId();
  if (!gid) return;

  // Mark everything up to now as read (any author)
  const latestAnyTs = Array.isArray(chatMessages) && chatMessages.length
    ? toMs(chatMessages[chatMessages.length - 1])
    : Date.now();

  setLastReadTs(gid, user, latestAnyTs);
};
// --- Chat polling: every 30s when chat is closed and tab is visible ---
const chatPollTimerRef = useRef(null);
const chatFetchInFlight = useRef(false);

useEffect(() => {
  // Don't poll while the chat panel is open
  if (showChat) return;

  // Need a valid game + user to poll meaningfully
  const gid = typeof effectiveId === "function" ? effectiveId() : game?.id;
  if (!gid || !user) return;

  // Only poll when page is visible
 const tick = async () => {
  if (chatFetchInFlight.current) return;
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  chatFetchInFlight.current = true;
  try {
    await loadChatMessages();
  } finally {
    chatFetchInFlight.current = false;
  }
};


  // Immediate fetch when polling starts/resumes
  tick();

  // 30s interval
  chatPollTimerRef.current = setInterval(tick, 30000);

  return () => {
    if (chatPollTimerRef.current) {
      clearInterval(chatPollTimerRef.current);
      chatPollTimerRef.current = null;
    }
  };
}, [showChat, loadChatMessages, user?.id, user?.email, effectiveGameId, effectiveId]);

// Refresh chat when window gains focus or tab becomes visible
useEffect(() => {
  const onFocus = () => {
    if (!showChat) loadChatMessages();
  };
  const onVis = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible" && !showChat) {
      loadChatMessages();
    }
  };
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVis);
  return () => {
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVis);
  };
}, [showChat, loadChatMessages]);


  /* ------------------------------- data load ------------------------------- */

  const loadGameData = useCallback(async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      let idToLoad = effectiveId();

      // try to discover a game if we still have no id (user refresh without query, etc.)
      if (!idToLoad) {
        const all = await Game.list();
        const mine = (all || [])
          .filter((g) => Array.isArray(g.players) && g.players.some((p) => p.email === currentUser.email))
          .sort(
            (a, b) =>
              new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
          );

        const pick = mine.find((g) => g.status === "in_progress") || mine.find((g) => g.status === "waiting") || mine[0];
        if (pick?.id) {
          idToLoad = pick.id;
          setEffectiveGameId(pick.id);
          try {
            const u = new URL(window.location.href);
            u.searchParams.set("gameId", pick.id);
            window.history.replaceState({}, "", u.toString());
          } catch {}
        }
      }

      if (!idToLoad) {
        console.warn("No game id available (no ?gameId=, no remembered id, and none discovered).");
        setLoading(false);
        return;
      }

      let currentGame = await Game.get(idToLoad);
      if (!currentGame) {
        setLoading(false);
        return;
      }

      // derive supply center counts on players for display
      if (currentGame.game_state?.supply_centers) {
        const updatedPlayers = (currentGame.players || []).map((player) => {
          const count = Object.values(currentGame.game_state.supply_centers).filter((owner) => owner === player.country)
            .length;
          return { ...player, supply_centers: count };
        });
        currentGame = { ...currentGame, players: updatedPlayers };
      }

      setGame(currentGame);
      setUnits(ensureUniqueUnitIds(currentGame.game_state?.units || initialUnits || []));
      setLastTurnResults(currentGame.game_state?.last_turn_results || null);

      // reset local order state on load
      setOrders({});
      setWinterActions([]);
      setRetreatOrders({});
      setIsSubmitted(false);

      const filter = {
        game_id: currentGame.id,
        player_email: currentUser.email,
        turn_number: currentGame.current_turn,
        phase: currentGame.current_phase,
      };
      if (currentGame.current_phase === "retreat") {
        const sourcePhase = currentGame.game_state?.phase_after_retreat === "fall" ? "spring" : "fall";
        filter.source_phase = sourcePhase;
      }

      const savedMoves = await GameMove.filter(filter);
      if (savedMoves.length > 0 && savedMoves[0]) {
  const move = savedMoves[0];

  // move.orders might be an array or an object; normalize to object keyed by canonical unit_id
  const incoming = move.orders || {};
  const arr = Array.isArray(incoming) ? incoming : Object.values(incoming);

  const canonicalized = {};
  for (const o of arr) {
    if (!o) continue;
    const id = toCanonicalUnitId(o.unit_id ?? o.unit?.id ?? o.id, currentGame.game_state?.units || []);
    if (!id) continue;
    canonicalized[id] = {
      ...o,
      unit_id: id,
      territory: normProv(o.territory),
      target: normProv(o.target),
      target_of_support: normProv(o.target_of_support),
      convoy_destination: normProv(o.convoy_destination),
    };
  }

  setOrders(canonicalized);
 setWinterActions(move.winter_actions || []);
 // Canonicalize saved retreat orders (object keyed by unit_id or array)
 {
   const rIncoming = move.retreat_orders || {};
   const rArr = Array.isArray(rIncoming) ? rIncoming : Object.values(rIncoming);
   const rCanon = {};
   for (const r of rArr) {
     if (!r) continue;
     const id = toCanonicalUnitId(r.unit_id ?? r.unit?.id ?? r.id, currentGame.game_state?.units || []);
     if (!id) continue;
     rCanon[id] = { ...r, unit_id: id, target: normProv(r.target) };
   }
   setRetreatOrders(rCanon);
}
          setIsSubmitted(!!move.submitted);
      }

      await loadChatMessages(currentGame.id, currentUser);
      setLoading(false);
    } catch (err) {
      console.error("Error loading game data:", err);
      setLoading(false);
    }
  }, [effectiveId, loadChatMessages]);

  useEffect(() => {
  loadGameData();
}, [effectiveGameId, loadGameData]);

  /* ---------------------------- order handlers ---------------------------- */

  const handleSetOrder = (unitId, order) => {
setIsSubmitted(false);   
const canonicalId = toCanonicalUnitId(unitId, units);
  if (!order || !order.action) {
    setOrders((prev) => {
      const next = { ...prev };
      delete next[canonicalId];
      return next;
    });
    return;
  }
  setOrders((prev) => ({
    ...prev,
    [canonicalId]: {
      ...order,
      unit_id: canonicalId,
      territory: normProv(order.territory),
      target: normProv(order.target),
      target_of_support: normProv(order.target_of_support),
      convoy_destination: normProv(order.convoy_destination),
    },
  }));
};


  const handleSetRetreatOrder = (unitId, order) => {
setIsSubmitted(false); 
  const canonicalId = toCanonicalUnitId(unitId, units);
  if (!order || !order.action) {
    setRetreatOrders((prev) => {
      const next = { ...prev };
      delete next[canonicalId];
      return next;
    });
    return;
  }
  setRetreatOrders((prev) => ({
    ...prev,
    [canonicalId]: {
      ...order,
      unit_id: canonicalId,
      target: normProv(order.target),
    },
  }));
};



  const handleDeleteOrder = (unitId) => {
   const canonicalId = toCanonicalUnitId(unitId, units);
   setOrders((prev) => {
     const next = { ...prev };
     delete next[canonicalId];
     return next;
   });
 };

  /* ----------------------------- save / submit ---------------------------- */

  const handleSaveOrders = async (isFinalSubmission) => {
    try {
      setIsSavingOrders(true);
      if (!game || !user) {
        alert("Game or user data not loaded.");
        return;
      }
      if (!game.current_turn || !game.current_phase) {
        alert("Game state not fully loaded.");
        return;
      }
      const gid = effectiveId();
      if (!gid) {
        alert("Cannot save orders: Game ID is missing.");
        return;
      }

      const userPlayer = game.players?.find((p) => p.email === user.email);
      if (!userPlayer) {
        alert("You are not a player in this game.");
        return;
      }

      let formattedOrders;
      if (game.current_phase === "winter") {
        const arr = Array.isArray(winterActions) ? winterActions : [];
        const builds = arr
          .filter((o) => o && o.action === "build")
          .map((o) => ({ action: "build", territory: o.territory, unit_type: o.unit_type }));
        const disbands = arr
          .filter((o) => o && o.action === "disband")
          .map((o) => {
            const rawId = o.unit_id ?? o.unit?.id ?? null;
            const unit_id = rawId ? stripTempSuffix(String(rawId)) : null;
            return unit_id ? { action: "disband", unit_id } : null;
          })
          .filter(Boolean);
        formattedOrders = [...disbands, ...builds];
      } else if (game.current_phase === "retreat") {
        formattedOrders = Object.entries(retreatOrders).map(([unit_id, o]) => ({
          ...o,
          unit_id: stripTempSuffix(String(unit_id)),
        }));
      } else {
        formattedOrders = Object.entries(orders)
          .map(([unit_id, o]) => ({
            ...o,
            unit_id: stripTempSuffix(String(unit_id)),
            territory: normProv(o.territory),
            target: normProv(o.target),
            target_of_support: normProv(o.target_of_support),
            convoy_destination: normProv(o.convoy_destination),
          }))
          .filter((o) => !!o.action);
      }

// Ensure one logical order per key (latest wins)
const keyFor = (o) => {
  if (!o || !o.action) return null;
  const action = String(o.action).toLowerCase();

  switch (action) {
    case "build":
      // builds keyed by location + unit type
      return `build:${normProv(o.territory)}:${String(o.unit_type || "").toLowerCase()}`;

    case "disband":
      // disbands keyed by the unit being disbanded
      return `disband:${String(o.unit_id || "").toUpperCase()}`;

    case "retreat":
      return `retreat:${String(o.unit_id || "").toUpperCase()}`;

    default:
      // move/hold/support/convoy → one per unit
      return `${action}:${String(o.unit_id || "").toUpperCase()}`;
  }
};

if (Array.isArray(formattedOrders)) {
  const map = new Map();
  for (const o of formattedOrders) {
    const k = keyFor(o);
    if (!k) continue;
    map.set(k, o); // latest wins
  }
  formattedOrders = Array.from(map.values());
}

      const filter = {
        game_id: gid,
        player_email: user.email,
        turn_number: game.current_turn,
        phase: game.current_phase,
      };
      const moveData = { orders: formattedOrders, submitted: isFinalSubmission };

      if (game.current_phase === "retreat") {
        const sourcePhase = game.game_state?.phase_after_retreat === "fall" ? "spring" : "fall";
        filter.source_phase = sourcePhase;
        moveData.source_phase = sourcePhase;
      }

      const existing = await GameMove.filter(filter);
      if (existing.length > 0) {
        await GameMove.update(existing[0].id, moveData);
      } else {
        await GameMove.create({
          game_id: gid,
          email: user.email,
          country: userPlayer.country,
          turn_number: game.current_turn,
          phase: game.current_phase,
          ...moveData,
        });
      }

      if (isFinalSubmission) {
        setIsSubmitted(true);
        await checkAndAdvancePhase();
      } else {
        setIsSubmitted(false);
      }
    } catch (error) {
      console.error("Error saving orders:", error);
      alert("Failed to save orders. Please try again.");
    } finally {
      setIsSavingOrders(false);
    }
  };

  const handleUnsubmitOrders = async () => {
    try {
      if (!game || !user) {
        alert("Game or user data not loaded.");
        return;
      }
      if (!game.current_turn || !game.current_phase) {
        alert("Game state not fully loaded.");
        return;
      }

      const filter = {
        game_id: effectiveId(),
        player_email: user.email,
        turn_number: game.current_turn,
        phase: game.current_phase,
      };
      if (game.current_phase === "retreat") {
        filter.source_phase = game.game_state?.phase_after_retreat === "fall" ? "spring" : "fall";
      }

      const existing = await GameMove.filter(filter);
      if (existing.length > 0) {
        await GameMove.update(existing[0].id, { submitted: false, orders: [] });
        setIsSubmitted(false);
        alert("Orders unsubmitted!");
      } else {
        alert("No submitted orders found to unsubmit.");
      }
    } catch (error) {
      console.error("Error unsubmitting orders:", error);
      alert("Failed to unsubmit orders. Please try again.");
    }
  };

  /* --------------------------- phase advancement --------------------------- */

  const advancePhase = useCallback(async () => {
    try {
      setIsResolving(true);

      let newUnits = [...units];
      let newGameState = { ...game.game_state };
      let newPlayers = [...game.players];
      let adjustmentsNeeded = false;
      let nextPhaseForUpdate;
      let nextTurn = game.current_turn;

      if (game.current_phase === "spring" || game.current_phase === "fall") {
        const allMoves = await GameMove.filter({
          game_id: effectiveId(),
          turn_number: game.current_turn,
          phase: game.current_phase,
        });

        const allOrdersRaw = allMoves.flatMap((move) => move.orders || []);
        const ordersForAdjudication = (allOrdersRaw || [])
          .map((o) => {
            if (!o) return null;
            const uid = stripTempSuffix(String(o.unit_id ?? o.unit?.id ?? ""));
            if (!uid) return null;
            return {
              ...o,
              unit_id: uid,
              territory: normProv(o.territory),
              target: normProv(o.target),
              target_of_support: normProv(o.target_of_support),
              convoy_destination: normProv(o.convoy_destination),
            };
          })
          .filter(Boolean);

        const result = adjudicate(units, ordersForAdjudication);
        newUnits = result.newUnits;

        const movePhaseResults = {
          phase: game.current_phase,
          turn: game.current_turn,
          orders: Array.isArray(allOrdersRaw) ? [...allOrdersRaw] : [],
          successful_moves: [],
          failed_moves: [],
          holds: [],
          dislodged_units: result.dislodgedUnits || [],
        };

        ordersForAdjudication.forEach((order) => {
          if (order.action === "move") {
            const before = units.find((u) => u.id === order.unit_id);
            const after = newUnits.find((u) => u.id === order.unit_id);
            if (before && after && after.territory === order.target) {
              movePhaseResults.successful_moves.push(order);
            } else {
              movePhaseResults.failed_moves.push(order);
            }
          } else if (order.action === "hold") {
            movePhaseResults.holds.push(order);
          }
        });

        newGameState.units = newUnits;
        newGameState.last_turn_results = movePhaseResults;

        if (result.dislodgedUnits.length > 0) {
          newGameState.retreats_required = (result.dislodgedUnits || [])
            .filter((r) => r && r.unit && r.unit.id)
            .map((r) => ({
              unit: r.unit,
              fromTerritory: r.fromTerritory ?? r.from ?? null,
              attackerTerritory: r.attackerTerritory ?? null,
              validRetreats: Array.isArray(r.validRetreats) ? r.validRetreats : [],
            }));
          newGameState.phase_after_retreat = game.current_phase === "spring" ? "fall" : "winter";

          const retreatDeadline = new Date();
          const turnLengthHours = game.turn_length_hours || 24;
          const retreatLengthHours = game.retreat_length_hours ?? Math.max(1, Math.floor(turnLengthHours / 2));
          retreatDeadline.setHours(retreatDeadline.getHours() + retreatLengthHours);

          await Game.update(effectiveId(), {
            current_phase: "retreat",
            phase_deadline: retreatDeadline.toISOString(),
            game_state: newGameState,
            draw_votes: [],
          });
          await loadGameData();
          setIsResolving(false);
          return;
        }

        if (game.current_phase === "fall") {
          // update supply centers
          const supplyCenterOwners = {};
          for (const terrId in territories) {
            if (territories[terrId].supply_center) {
              supplyCenterOwners[terrId] = newGameState.supply_centers?.[terrId] || null;
            }
          }
          for (const terrId in territories) {
            if (territories[terrId].supply_center) {
              const occupyingUnit = newUnits.find((u) => baseProv(u.territory) === terrId);
              if (occupyingUnit) supplyCenterOwners[terrId] = occupyingUnit.country;
            }
          }
          newGameState.supply_centers = supplyCenterOwners;

          newPlayers = game.players.map((p) => {
            const count = Object.values(supplyCenterOwners).filter((owner) => owner === p.country).length;
            return { ...p, supply_centers: count };
          });

          const playerUnitCounts = newPlayers.reduce((acc, p) => {
            acc[p.country] = newUnits.filter((u) => u.country === p.country).length;
            return acc;
          }, {});
          newPlayers.forEach((p) => {
            if (p.supply_centers !== (playerUnitCounts[p.country] || 0)) adjustmentsNeeded = true;
          });

          const winner = newPlayers.find((p) => p.supply_centers >= 18);
          if (winner) {
            await Game.update(effectiveId(), {
              status: "completed",
              winner_email: winner.email,
              winner_country: winner.country,
              game_state: newGameState,
              players: newPlayers,
            });
            alert(`${winner.country} has won the game!`);
            await loadGameData();
            setIsResolving(false);
            return;
          }

          if (adjustmentsNeeded) {
            nextPhaseForUpdate = "winter";
            nextTurn = game.current_turn;
          } else {
            nextPhaseForUpdate = "spring";
            nextTurn = game.current_turn + 1;
          }
        } else {
          nextPhaseForUpdate = "fall";
          nextTurn = game.current_turn;
        }
      } else if (game.current_phase === "retreat") {
        const sourcePhase = game.game_state?.phase_after_retreat === "fall" ? "spring" : "fall";
        const retreatMoves = await GameMove.filter({
          game_id: effectiveId(),
          turn_number: game.current_turn,
          phase: "retreat",
          source_phase: sourcePhase,
        });

        let currentUnits = [...game.game_state.units];
        const retreatsRequired = Array.isArray(game.game_state?.retreats_required)
          ? game.game_state.retreats_required.filter((r) => r && r.unit && r.unit.id)
          : [];

        let allRetreatOrders = retreatMoves.flatMap((m) => m.orders || []);
        const unitSet = new Set((units || []).map((u) => String(u.id)));
        allRetreatOrders = allRetreatOrders
          .map((o) => {
            if (!o) return null;
            const rawId = o.unit_id ?? o.unit?.id ?? null;
            const unit_id = rawId ? stripTempSuffix(String(rawId)) : null;
            if (!unit_id) return null;
            return { ...o, unit_id };
          })
          .filter(Boolean)
          .filter((o) => unitSet.has(o.unit_id));

        allRetreatOrders.forEach((order) => {
          if (order.action === "retreat" && order.target) {
            const idx = currentUnits.findIndex((u) => u.id === order.unit_id);
            if (idx !== -1) {
              currentUnits[idx].territory = order.target;
              delete currentUnits[idx].dislodged;
            }
          }
        });

        const requiredIds = new Set(retreatsRequired.map((r) => r.unit.id));
        const submittedIds = new Set(allRetreatOrders.map((o) => o.unit_id));
        const disbandIds = new Set(
          allRetreatOrders.filter((o) => o.action === "disband").map((o) => o.unit_id)
        );
        requiredIds.forEach((uid) => {
          if (!submittedIds.has(uid)) disbandIds.add(uid);
        });

        const retreatResults = {
          phase: "retreat",
          turn: game.current_turn,
          successful_moves: [],
          failed_moves: [],
          holds: [],
          dislodged_units: [],
        };

        retreatsRequired.forEach((retreat) => {
          const order = allRetreatOrders.find((o) => o.unit_id === retreat.unit.id);
          const wasDisbanded = disbandIds.has(retreat.unit.id);
          if (order && order.action === "retreat" && order.target && !wasDisbanded) {
            retreatResults.successful_moves.push({ ...order, unit: retreat.unit });
          } else {
            retreatResults.failed_moves.push({
              unit_id: retreat.unit.id,
              action: "disband",
              territory: retreat.unit.territory,
              unit: retreat.unit,
            });
          }
        });

        currentUnits = currentUnits.filter((u) => u?.id && !disbandIds.has(u.id) && !u.dislodged);
        const newUnitsFinal = currentUnits;
        newUnits = newUnitsFinal;
        let nextPhase = game.game_state.phase_after_retreat;
        const newGame = { ...game.game_state, units: newUnitsFinal, last_turn_results: retreatResults };
        delete newGame.retreats_required;
        delete newGame.phase_after_retreat;
        newGameState = newGame;

        if (nextPhase === "winter") {
          // same as end-of-fall supply center recalc
          const supplyCenterOwners = {};
          for (const terrId in territories) {
            if (territories[terrId].supply_center) supplyCenterOwners[terrId] = newGameState.supply_centers?.[terrId] || null;
          }
          for (const terrId in territories) {
            if (territories[terrId].supply_center) {
              const occupyingUnit = newUnitsFinal.find((u) => baseProv(u.territory) === terrId);
              if (occupyingUnit) supplyCenterOwners[terrId] = occupyingUnit.country;
            }
          }
          newGameState.supply_centers = supplyCenterOwners;

          newPlayers = game.players.map((p) => {
            const count = Object.values(supplyCenterOwners).filter((owner) => owner === p.country).length;
            return { ...p, supply_centers: count };
          });

          const playerUnitCounts = newPlayers.reduce((acc, p) => {
            acc[p.country] = newUnitsFinal.filter((u) => u.country === p.country).length;
            return acc;
          }, {});
          newPlayers.forEach((p) => {
            if (p.supply_centers !== (playerUnitCounts[p.country] || 0)) adjustmentsNeeded = true;
          });

          const winner = newPlayers.find((p) => p.supply_centers >= 18);
          if (winner) {
            await Game.update(effectiveId(), {
              status: "completed",
              winner_email: winner.email,
              winner_country: winner.country,
              game_state: newGameState,
              players: newPlayers,
            });
            alert(`${winner.country} has won the game!`);
            await loadGameData();
            setIsResolving(false);
            return;
          }

          if (adjustmentsNeeded) {
            nextPhaseForUpdate = "winter";
            nextTurn = game.current_turn;
          } else {
            nextPhaseForUpdate = "spring";
            nextTurn = game.current_turn + 1;
          }
        } else {
          nextPhaseForUpdate = nextPhase;
          nextTurn = nextPhaseForUpdate === "spring" ? game.current_turn + 1 : game.current_turn;
        }
      } else if (game.current_phase === "winter") {
        const winterMoves = await GameMove.filter({
          game_id: effectiveId(),
          turn_number: game.current_turn,
          phase: "winter",
        });

        const allDisbandOrders = winterMoves.flatMap((m) =>
          (Array.isArray(m.orders) ? m.orders : []).filter((o) => o.action === "disband")
        );
        const unitsAfterDisbands = newUnits.filter((u) => !allDisbandOrders.some((d) => d.unit_id === u.id));

        const builtUnits = [];
        const existingIds = new Set((unitsAfterDisbands || []).map((u) => String(u.id).toUpperCase()));
        winterMoves.forEach((move) => {
          const country = move.country;
          const buildsForThisMove = (Array.isArray(move.orders) ? move.orders : []).filter((o) => o.action === "build");
          buildsForThisMove.forEach((buildOrder) => {
            const origin = buildOrder.territory;
            const type = buildOrder.unit_type;
            const id = makeUnitId(country, origin, type, existingIds);
            existingIds.add(id);
            builtUnits.push({ id, country, type, territory: origin, home: origin, origin });
          });
        });

        const newUnitsRaw = [...(unitsAfterDisbands || []), ...builtUnits];
        newUnits = ensureUniqueUnitIds(newUnitsRaw);
        newGameState.units = newUnits;
        nextPhaseForUpdate = "spring";
        nextTurn = game.current_turn + 1;
      }

      const deadline = new Date();
      const turnLengthHours = game.turn_length_hours || 24;
      deadline.setHours(deadline.getHours() + turnLengthHours);

      await Game.update(effectiveId(), {
        current_phase: nextPhaseForUpdate,
        current_turn: nextTurn,
        phase_deadline: deadline.toISOString(),
        game_state: newGameState,
        players: newPlayers,
        draw_votes: [],
      });

      await loadGameData();
    } catch (error) {
      console.error("Error advancing phase:", error);
    } finally {
      setIsResolving(false);
    }
  }, [game, units, effectiveId, loadGameData]);

  const checkAndAdvancePhase = useCallback(
    async (forceAdvance = false) => {
      try {
        if (!game) return;

        const filter = {
          game_id: effectiveId(),
          turn_number: game.current_turn,
          phase: game.current_phase,
          submitted: 1,
        };

        if (game.current_phase === "retreat") {
          filter.source_phase = game.game_state?.phase_after_retreat === "fall" ? "spring" : "fall";
        }

        const submittedMoves = await GameMove.filter(filter);

        let requiredPlayers;
        if (game.current_phase === "winter") {
          const playerUnitCounts = (game.players || []).reduce((acc, p) => {
            acc[p.country] = (units || []).filter((u) => u.country === p.country).length;
            return acc;
          }, {});
          requiredPlayers = (game.players || []).filter((p) => {
            const unitCount = playerUnitCounts[p.country] || 0;
            const scCount = p.supply_centers || 0;
            return unitCount !== scCount && !p.is_dummy;
          });
        } else if (game.current_phase === "retreat") {
          const retreatsRequired = Array.isArray(game.game_state?.retreats_required)
            ? game.game_state.retreats_required.filter((r) => r && r.unit && r.unit.id)
            : [];
          const countries = new Set(retreatsRequired.map((r) => r.unit?.country).filter(Boolean));
          requiredPlayers = (game.players || []).filter((p) => countries.has(p.country) && !p.is_dummy);
        } else {
          requiredPlayers = (game.players || []).filter((p) => !p.is_dummy);
        }

        const submittedEmails = new Set(submittedMoves.map((m) => m.email));
        const requiredEmails = new Set(requiredPlayers.map((p) => p.email));
        const submittedCount = [...requiredEmails].filter((e) => submittedEmails.has(e)).length;

        if (forceAdvance || submittedCount >= requiredPlayers.length) {
          await advancePhase();
        } else {
          const waiting = requiredPlayers.filter((p) => !submittedEmails.has(p.email)).map((p) => p.country);
          console.log("Still waiting for:", waiting);
        }
      } catch (error) {
        console.error("Error checking phase advancement:", error);
      }
    },
    [game, units, effectiveId, advancePhase]
  );

  // timer expiry
  useEffect(() => {
    autoAdvanceFiredRef.current = false;
  }, [game?.phase_deadline]);

  const handlePhaseExpired = useCallback(() => {
    if (autoAdvanceFiredRef.current) return;
    autoAdvanceFiredRef.current = true;
    checkAndAdvancePhase(true);
  }, [checkAndAdvancePhase]);

  // manual refresh
  const onReload = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await loadGameData();
      await loadChatMessages();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadGameData, loadChatMessages]);

  /* --------------------------------- UI --------------------------------- */

  if (loading || isResolving) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-slate-600">{isResolving ? "Adjudicating turn..." : "Loading diplomatic theater..."}</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Card className="text-center p-8">
          <CardContent>
            <h2 className="text-xl font-semibold text-slate-700 mb-4">Game Not Found</h2>
            <p className="text-slate-500 mb-6">The requested game could not be located.</p>
            <Link to={createPageUrl("GameLobby")}>
              <Button>Return to Lobby</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userPlayer = game.players?.find((p) => p.email === user.email);
  const isMobile = windowWidth < 768;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-slate-200 p-3 md:p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 md:gap-4">
            <Link to={createPageUrl("GameLobby")}>
              <Button variant="ghost" size="icon" className="hover:bg-slate-100 w-8 h-8 md:w-10 md:h-10">
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900">{game.name}</h1>
              <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm text-slate-600">
                <span>
                  {game.current_phase.charAt(0).toUpperCase() + game.current_phase.slice(1)} {1900 + game.current_turn}
                </span>
                {userPlayer && (
                  <span className="flex items-center gap-1">
                    Playing as
                    <div
                      className="w-2 h-2 md:w-3 md:h-3 rounded-full ml-1 mr-1"
                      style={{ backgroundColor: userPlayer.color }}
                    />
                    <span className="hidden sm:inline">{userPlayer.country}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            {game.phase_deadline && game.status === "in_progress" && (
              <PhaseTimer deadline={game.phase_deadline} onExpire={handlePhaseExpired} />
            )}
            <Button
              variant="outline"
              onClick={() => setShowPlayerPanel(!showPlayerPanel)}
              className="relative text-xs md:text-sm"
              size="sm"
            >
              <Users className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Powers</span>
            </Button>
            <Button variant="outline" onClick={handleOpenChat} className="relative text-xs md:text-sm" size="sm">
              <MessageSquare className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Chat</span>
              {hasUnreadMessages === true && (
  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
)}
            </Button>
            <Button
              variant="outline"
              onClick={onReload}
              className="relative text-xs md:text-sm"
              size="sm"
              title="Refresh game state"
              disabled={isRefreshing}
            >
              <RefreshCcw className={`w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{isRefreshing ? "Refreshing…" : "Refresh"}</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 relative">
            <DiplomacyMap
              game={game}
              user={user}
              units={units}
              orders={showLastTurnResults ? {} : game.current_phase === "retreat" ? retreatOrders : orders}
              onSetOrder={game.current_phase === "retreat" ? handleSetRetreatOrder : handleSetOrder}
              showLastTurnResults={showLastTurnResults}
              lastTurnResults={lastTurnResults}
              onBackgroundClick={() => setShowPlayerPanel(false)}
            />
            {game.status === "completed" && (
              <div className="absolute inset-0 pointer-events-none" />
            )}
          </div>
        </div>
      </div>

      {/* Player Panel */}
      {showPlayerPanel && (
        <motion.div
          initial={{ x: -400 }}
          animate={{ x: 0 }}
          exit={{ x: -400 }}
          className="absolute left-0 top-0 h-full w-80 md:w-96 bg-white border-r border-slate-200 shadow-xl z-20"
        >
          <div className="h-full flex flex-col">
            <PlayerPanel game={game} user={user} onClose={() => setShowPlayerPanel(false)} />
            <GameControls
              game={game}
              user={user}
              units={units}
              orders={game.current_phase === "retreat" ? retreatOrders : orders}
              onDeleteOrder={handleDeleteOrder}
              onSaveOrders={() => handleSaveOrders(false)}
              onSubmitOrders={() => handleSaveOrders(true)}
              onUnsubmitOrders={handleUnsubmitOrders}
              onVoteDraw={async (v) => {
                try {
                  const currentVotes = game.draw_votes || [];
                  const newVotes = v
                    ? [...new Set([...currentVotes, user.email])]
                    : currentVotes.filter((email) => email !== user.email);
                  await Game.update(effectiveId(), { draw_votes: newVotes });

                  const activePlayerEmails = (game.players || [])
                    .filter((p) => !p.is_dummy && (units || []).some((u) => u.country === p.country))
                    .map((p) => p.email);

                  const allActiveVoted =
                    activePlayerEmails.length > 0 && activePlayerEmails.every((email) => newVotes.includes(email));

                  if (allActiveVoted) {
                    await Game.update(effectiveId(), {
                      status: "completed",
                      winners: activePlayerEmails,
                    });
                    alert("All active players have agreed to a draw. The game is over.");
                    await loadGameData();
                  }
                } catch (error) {
                  console.error("Error voting for draw:", error);
                  await loadGameData();
                }
              }}
              isSubmitted={isSubmitted}
              isResolving={isResolving}
              winterActions={winterActions}
              onSetWinterActions={setWinterActions}
              showLastTurnResults={showLastTurnResults}
              onToggleLastTurnResults={() => setShowLastTurnResults(!showLastTurnResults)}
              lastTurnResults={lastTurnResults}
              onSetRetreatOrder={handleSetRetreatOrder}
              isSavingOrders={isSavingOrders}
            />
          </div>
        </motion.div>
      )}

      {/* Chat Panel */}
      {showChat && (
        <motion.div
          initial={isMobile ? { y: "100%" } : { x: "100%" }}
          animate={{ y: 0, x: 0 }}
          exit={isMobile ? { y: "100%" } : { x: "100%" }}
          transition={{ type: "spring", stiffness: 350, damping: 40 }}
          className="fixed inset-0 z-50 md:absolute md:inset-y-0 md:right-0 md:w-96 md:max-w/full bg-white md:border-l md:border-slate-200 md:shadow-xl"
        >
          <GameChat
            game={game}
            user={user}
            messages={chatMessages}
            onSendMessage={async (message, threadId, participants) => {
              try {
                const gid = effectiveId();
                if (!gid) return;
                const userCountry = game.players?.find((p) => p.email === user.email)?.country;
                await ChatMessage.create({
                  game_id: gid,
                  thread_id: threadId,
                  thread_participants: participants,
                  sender_email: user.email,
                  sender_country: userCountry,
                  message,
                });
	        // Mark my own send as read so the badge doesn't light on myself
                setLastReadTs(gid, user, Date.now());
                setHasUnreadMessages(false);
                loadChatMessages();
              } catch (error) {
                console.error("Error sending message:", error);
              }
            }}
            onClose={() => setShowChat(false)}
          />
        </motion.div>
      )}
    </div>
  );
}
