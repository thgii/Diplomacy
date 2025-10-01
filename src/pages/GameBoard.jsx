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

// Strip client temp suffixes like "-1758730630474"
const stripTempSuffix = (id) =>
  typeof id === "string" ? id.replace(/-\d{13,}$/, "") : id;

// Canonicalize a territory id to its base province (e.g., "SPA/sc" -> "SPA")
const baseProv = (t) =>
  typeof t === "string" && t.includes("/") ? t.split("/")[0] : t;

// Make a stable, globally-unique unit id. Uses a readable base + counter if needed.
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

// Ensure a units[] array has unique ids; fix dupes deterministically.
const ensureUniqueUnitIds = (units) => {
  const seen = new Set();
  return (units || []).map((u) => {
    const country = u.country ?? u.nation ?? "UNK";
    const origin = u.home ?? u.origin ?? u.start ?? u.start_territory ?? u.original_territory ?? u.territory ?? "UNK";
    const type = u.type ?? u.unit_type ?? "ARMY";
    let id = (u.id ? String(u.id) : `${country}-${origin}-${type}`).toUpperCase();
    if (seen.has(id)) {
      id = makeUnitId(country, origin, type, seen);
    }
    seen.add(id);
    return { ...u, id };
  });
};

export default function GameBoard() {
  const [game, setGame] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showPlayerPanel, setShowPlayerPanel] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [orders, setOrders] = useState({});
  const [units, setUnits] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  const [isResolving, setIsResolving] = useState(false);
  const [winterActions, setWinterActions] = useState([]);
  const [showLastTurnResults, setShowLastTurnResults] = useState(false);
  const [lastTurnResults, setLastTurnResults] = useState(null);
  const [retreatOrders, setRetreatOrders] = useState({});
  const [showVictoryOverlay, setShowVictoryOverlay] = useState(true);
  const [isSavingOrders, setIsSavingOrders] = useState(false);
  const autoAdvanceFiredRef = useRef(false);

  // --------- Effective game id (URL first, else loaded game) ----------
// --------- Effective game id (URL first, then path, then last-viewed, then loaded game) ----------
const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
const qsId = url ? url.searchParams.get("gameId") : null;
// Support routes like /game/123 or /games/123
const pathId = typeof window !== "undefined"
  ? (window.location.pathname.match(/\/games?\/([^/?#]+)/)?.[1] || null)
  : null;
// Remember the last opened game so reloads without a query still work
const storedId = typeof window !== "undefined" ? localStorage.getItem("lastViewedGameId") : null;

const [game, setGame] = useState(null);
// ...
const [effectiveGameId, setEffectiveGameId] = useState(qsId || pathId || storedId || null);
const effectiveId = useCallback(
  () => (qsId || pathId || storedId || game?.id || null),
  [qsId, pathId, storedId, game?.id]
);

useEffect(() => {
  const next = (qsId || pathId || storedId || game?.id || null);
  setEffectiveGameId(next);
}, [qsId, pathId, storedId, game?.id]);

// When we successfully load a game, persist it for refreshes
useEffect(() => {
  if (game?.id && typeof window !== "undefined") {
    localStorage.setItem("lastViewedGameId", game.id);
  }
}, [game?.id]);


  // --------- Resize listener (fixes dangling "innerWidth);" error) ----------
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize(); // initialize
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --------- Chat loader ----------
  const loadChatMessages = useCallback(async () => {
    try {
      const gid = effectiveId();
      if (!gid) return;
      const msgs = await ChatMessage.filter({ game_id: gid });
      // sort ascending by created_date
      const sorted = [...(msgs || [])].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setChatMessages(sorted);

      // unread indicator
      const lastReadKey = `lastRead_${gid}`;
      const lastRead = localStorage.getItem(lastReadKey);
      if (!lastRead && sorted.length) {
        setHasUnreadMessages(true);
        return;
      }
      if (lastRead && sorted.length) {
        const newest = sorted[sorted.length - 1].created_date;
        setHasUnreadMessages(new Date(newest) > new Date(lastRead));
      } else {
        setHasUnreadMessages(false);
      }
    } catch (e) {
      console.error("Error loading chat messages:", e);
    }
  }, [effectiveId]);

  // --------- Game loader ----------
  const loadGameData = useCallback(async () => {
  try {
    const currentUser = await User.me();
    setUser(currentUser);

    // Try all the easy sources first
    let idToLoad = effectiveId();

    // If still no id, try to find a reasonable default:
    if (!idToLoad) {
      // 1) Look for any game the user is in (prefer in_progress, then waiting), newest first
      const all = await Game.list();
      const mine = (all || [])
        .filter(g => Array.isArray(g.players) && g.players.some(p => p.email === currentUser.email))
        .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));

      const pick =
        mine.find(g => g.status === "in_progress") ||
        mine.find(g => g.status === "waiting") ||
        mine[0];

      if (pick?.id) {
        idToLoad = pick.id;
        // Optionally push the id into the URL so refreshes have it:
        try {
          const u = new URL(window.location.href);
          u.searchParams.set("gameId", idToLoad);
          window.history.replaceState({}, "", u.toString());
        } catch {}
      }
    }

    if (!idToLoad) {
      console.warn("No game id available (no ?gameId=, no path id, no remembered id, and none discovered).");
      setLoading(false);
      return;
    }

    const currentGame = await Game.get(idToLoad);
    if (!currentGame) {
      setLoading(false);
      return;
    }

      const currentGame = await Game.get(idToLoad);
      if (currentGame) {
        if (currentGame.game_state?.supply_centers) {
          const updatedPlayers = currentGame.players.map((player) => {
            const count = Object.values(currentGame.game_state.supply_centers).filter((owner) => owner === player.country).length;
            return { ...player, supply_centers: count };
          });
          currentGame.players = updatedPlayers;
        }

        setGame(currentGame);
        setUnits(currentGame.game_state?.units || initialUnits || []);

        if (currentGame.game_state?.last_turn_results) {
          setLastTurnResults(currentGame.game_state.last_turn_results);
        } else {
          setLastTurnResults(null);
        }

        // Reset local order-ish state each load
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
        if (savedMoves.length > 0) {
          const move = savedMoves[0];
          if (move && move.orders) {
            setOrders(move.orders || {});
            setWinterActions(move.winter_actions || []);
            setRetreatOrders(move.retreat_orders || {});
            setIsSubmitted(!!move.submitted);
          } else {
            setOrders({});
            setWinterActions([]);
            setRetreatOrders({});
            setIsSubmitted(false);
          }
        } else {
          setOrders({});
          setWinterActions([]);
          setRetreatOrders({});
          setIsSubmitted(false);
        }

        await loadChatMessages();
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading game data:", err);
      setLoading(false);
    }
  }, [gameId, game?.id, loadChatMessages]);

  useEffect(() => {
    if (!units) return;
    // eslint-disable-next-line no-console
    console.log("Render units:", { count: units.length, sample: units.slice(0, 3) });
  }, [units]);

  // --------- Handlers ----------
  const handleSetOrder = (unitId, order) => {
    const safeId = stripTempSuffix(String(unitId));

    // Drop empty orders
    if (!order || !order.action) {
      setOrders((prev) => {
        const next = { ...prev };
        delete next[safeId];
        return next;
      });
      return;
    }

    const normProv = (s) => {
      if (typeof s !== "string") return s;
      const t = s.trim();
      if (!t) return t;
      const [base, coast] = t.split("/");
      return coast ? `${base.toUpperCase()}/${coast.toLowerCase()}` : base.toUpperCase();
    };

    setOrders((prev) => ({
      ...prev,
      [safeId]: {
        ...order,
        unit_id: safeId,
        territory: normProv(order.territory),
        target: normProv(order.target),
        target_of_support: normProv(order.target_of_support),
        convoy_destination: normProv(order.convoy_destination),
      },
    }));
  };

  const handleSetRetreatOrder = (unitId, order) => {
    if (!order || !order.action) {
      setRetreatOrders((prev) => {
        const next = { ...prev };
        delete next[unitId];
        return next;
      });
      return;
    }

    const normProv = (s) => {
      if (typeof s !== "string") return s;
      const t = s.trim();
      if (!t) return t;
      const [base, coast] = t.split("/");
      return coast ? `${base.toUpperCase()}/${coast.toLowerCase()}` : base.toUpperCase();
    };

    setRetreatOrders((prev) => ({
      ...prev,
      [String(unitId)]: {
        ...order,
        unit_id: String(unitId),
        target: normProv(order.target),
      },
    }));
  };

  const handleDeleteOrder = (unitId) => {
    setOrders((prev) => {
      const next = { ...prev };
      delete next[unitId];
      return next;
    });
  };

  // --------- Phase advancement (unchanged except for effectiveId usage) ----------
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

        let allOrdersRaw = allMoves.flatMap((move) => move.orders || []);
        const ordersForDisplay = Array.isArray(allOrdersRaw) ? [...allOrdersRaw] : [];

        const unitId = (x) => (x ? stripTempSuffix(String(x)) : null);
        const liveUnitIds = new Set((units || []).map((u) => unitId(u.id)));

        const ordersForAdjudication = (allOrdersRaw || [])
          .map((o) => {
            if (!o) return null;
            const uid = unitId(o.unit_id ?? o.unit?.id);
            if (!uid) return null;
            const normProv = (s) => {
              if (typeof s !== "string") return s;
              const t = s.trim();
              if (!t) return t;
              const [base, coast] = t.split("/");
              return coast ? `${base.toUpperCase()}/${coast.toLowerCase()}` : base.toUpperCase();
            };
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

        const adjudicationResult = adjudicate(units, ordersForAdjudication);
        newUnits = adjudicationResult.newUnits;

        const movePhaseResults = {
          phase: game.current_phase,
          turn: game.current_turn,
          orders: ordersForDisplay,
          successful_moves: [],
          failed_moves: [],
          holds: [],
          dislodged_units: adjudicationResult.dislodgedUnits || [],
        };

        ordersForAdjudication.forEach((order) => {
          if (order.action === "move") {
            const originalUnit = units.find((u) => u.id === order.unit_id);
            const resultUnit = newUnits.find((u) => u.id === order.unit_id);
            if (originalUnit && resultUnit && resultUnit.territory === order.target) {
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

        if (adjudicationResult.dislodgedUnits.length > 0) {
          newGameState.retreats_required = (adjudicationResult.dislodgedUnits || [])
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
          const supplyCenterOwners = {};
          for (const terrId in territories) {
            if (territories[terrId].supply_center) {
              supplyCenterOwners[terrId] = newGameState.supply_centers?.[terrId] || null;
            }
          }
          for (const terrId in territories) {
            if (territories[terrId].supply_center) {
              const occupyingUnit = newUnits.find((u) => baseProv(u.territory) === terrId);
              if (occupyingUnit) {
                supplyCenterOwners[terrId] = occupyingUnit.country;
              }
            }
          }
          newGameState.supply_centers = supplyCenterOwners;

          newPlayers = game.players.map((player) => {
            const count = Object.values(supplyCenterOwners).filter((owner) => owner === player.country).length;
            return { ...player, supply_centers: count };
          });

          const playerUnitCounts = newPlayers.reduce((acc, p) => {
            acc[p.country] = newUnits.filter((u) => u.country === p.country).length;
            return acc;
          }, {});
          newPlayers.forEach((player) => {
            if (player.supply_centers !== (playerUnitCounts[player.country] || 0)) {
              adjustmentsNeeded = true;
            }
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
            const unitIndex = currentUnits.findIndex((u) => u.id === order.unit_id);
            if (unitIndex !== -1) {
              currentUnits[unitIndex].territory = order.target;
              delete currentUnits[unitIndex].dislodged;
            }
          }
        });

        const requiredRetreatUnitIds = new Set(retreatsRequired.map((r) => r.unit.id));
        const submittedOrderUnitIds = new Set(allRetreatOrders.map((o) => o.unit_id));
        const unitsToDisbandIds = new Set();

        allRetreatOrders.forEach((order) => {
          if (order.action === "disband") {
            unitsToDisbandIds.add(order.unit_id);
          }
        });

        requiredRetreatUnitIds.forEach((unitId) => {
          if (!submittedOrderUnitIds.has(unitId)) {
            unitsToDisbandIds.add(unitId);
          }
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
          const wasDisbanded = unitsToDisbandIds.has(retreat.unit.id);
          const originalUnit = retreat.unit;

          if (order && order.action === "retreat" && order.target && !wasDisbanded) {
            retreatResults.successful_moves.push({ ...order, unit: originalUnit });
          } else {
            retreatResults.failed_moves.push({
              unit_id: originalUnit.id,
              action: "disband",
              territory: originalUnit.territory,
              unit: originalUnit,
            });
          }
        });
        newGameState.last_turn_results = retreatResults;

        currentUnits = currentUnits.filter((u) => u?.id && !unitsToDisbandIds.has(u.id) && !u.dislodged);
        newUnits = currentUnits;
        newGameState.units = newUnits;

        let derivedNextPhase = game.game_state.phase_after_retreat;
        delete newGameState.retreats_required;
        delete newGameState.phase_after_retreat;

        if (derivedNextPhase === "winter") {
          const supplyCenterOwners = {};
          for (const terrId in territories) {
            if (territories[terrId].supply_center) {
              supplyCenterOwners[terrId] = newGameState.supply_centers?.[terrId] || null;
            }
          }
          for (const terrId in territories) {
            if (territories[terrId].supply_center) {
              const occupyingUnit = newUnits.find((u) => baseProv(u.territory) === terrId);
              if (occupyingUnit) {
                supplyCenterOwners[terrId] = occupyingUnit.country;
              }
            }
          }
          newGameState.supply_centers = supplyCenterOwners;

          newPlayers = game.players.map((player) => {
            const count = Object.values(supplyCenterOwners).filter((owner) => owner === player.country).length;
            return { ...player, supply_centers: count };
          });

          const playerUnitCounts = newPlayers.reduce((acc, p) => {
            acc[p.country] = newUnits.filter((u) => u.country === p.country).length;
            return acc;
          }, {});
          newPlayers.forEach((player) => {
            if (player.supply_centers !== (playerUnitCounts[player.country] || 0)) {
              adjustmentsNeeded = true;
            }
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
          nextPhaseForUpdate = derivedNextPhase;
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
            builtUnits.push({
              id,
              country,
              type,
              territory: origin,
              home: origin,
              origin: origin,
            });
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
  }, [game, effectiveId, units, loadGameData]);

  const checkAndAdvancePhase = useCallback(
    async (forceAdvance = false) => {
      try {
        if (!game) {
          console.warn("Game object is not loaded when trying to checkAndAdvancePhase.");
          return;
        }

        const filterOptions = {
          game_id: effectiveId(),
          turn_number: game.current_turn,
          phase: game.current_phase,
          submitted: true,
        };

        if (game.current_phase === "retreat") {
          const sourcePhase = game.game_state?.phase_after_retreat === "fall" ? "spring" : "fall";
          filterOptions.source_phase = sourcePhase;
        }

        const allSubmittedMoves = await GameMove.filter(filterOptions);

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
          const countriesWithRetreats = new Set(retreatsRequired.map((r) => r.unit?.country).filter(Boolean));
          requiredPlayers = (game.players || []).filter((p) => countriesWithRetreats.has(p.country) && !p.is_dummy);
        } else {
          requiredPlayers = (game.players || []).filter((p) => !p.is_dummy);
        }

        const submittedEmails = new Set(allSubmittedMoves.map((m) => m.player_email));
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
    [game, effectiveId, advancePhase, units]
  );

  // Reset guard each time the deadline changes
  useEffect(() => {
    autoAdvanceFiredRef.current = false;
  }, [game?.phase_deadline]);

  // Called once when the timer expires
  const handlePhaseExpired = useCallback(() => {
    if (autoAdvanceFiredRef.current) return;
    autoAdvanceFiredRef.current = true;
    checkAndAdvancePhase(true);
  }, [checkAndAdvancePhase]);

  const handleSaveOrders = async (isFinalSubmission) => {
    try {
      setIsSavingOrders(true);
      const userPlayer = game.players?.find((p) => p.email === user.email);
      if (!userPlayer) {
        alert("You are not a player in this game.");
        return;
      }
      if (!effectiveId()) {
        alert("Cannot save orders: Game ID is missing.");
        return;
      }
      if (!game || !game.current_turn || !game.current_phase) {
        alert("Game state not fully loaded. Cannot save orders.");
        return;
      }

      const isWinter = game.current_phase === "winter";
      const isRetreat = game.current_phase === "retreat";
      let formattedOrders;

      if (isWinter) {
        const buildOrders = winterActions.filter((action) => action.action === "build");
        if (buildOrders.length > 3) {
          alert("You can build a maximum of 3 units in winter. Please adjust your build orders.");
          return;
        }
        formattedOrders = Array.isArray(winterActions) ? winterActions : [];
      } else if (isRetreat) {
        formattedOrders = Object.entries(retreatOrders).map(([unit_id, o]) => ({
          ...o,
          unit_id: stripTempSuffix(String(unit_id)),
        }));
      } else {
        formattedOrders = Object.entries(orders).map(([unit_id, o]) => ({
          ...o,
          unit_id: stripTempSuffix(String(unit_id)),
        }));
      }

      const unitSet = new Set((units || []).map((u) => String(u.id)));
      const arr = Array.isArray(formattedOrders) ? formattedOrders : [];
      if (game.current_phase === "winter") {
        const builds = arr
          .filter((o) => o && o.action === "build")
          .map((o) => ({
            action: "build",
            territory: o.territory,
            unit_type: o.unit_type,
          }));
        const disbands = arr
          .filter((o) => o && o.action === "disband")
          .map((o) => {
            const rawId = o.unit_id ?? o.unit?.id ?? null;
            const unit_id = rawId ? stripTempSuffix(String(rawId)) : null;
            return unit_id ? { action: "disband", unit_id } : null;
          })
          .filter(Boolean)
          .filter((o) => unitSet.has(o.unit_id));
        formattedOrders = [...disbands, ...builds];
      } else {
        const norm = (s) => (typeof s === "string" ? s.trim().toUpperCase() : s);
        formattedOrders = arr
          .map((o) => {
            if (!o) return null;
            const rawId = o.unit_id ?? o.unit?.id ?? null;
            const unit_id = rawId ? stripTempSuffix(String(rawId)) : null;
            if (!unit_id) return null;
            return {
              ...o,
              unit_id,
              territory: norm(o.territory),
              target: norm(o.target),
              target_of_support: norm(o.target_of_support),
              convoy_destination: norm(o.convoy_destination),
            };
          })
          .filter(Boolean);
      }

      const filter = {
        game_id: effectiveId(),
        player_email: user.email,
        turn_number: game.current_turn,
        phase: game.current_phase,
      };

      const moveData = {
        orders: formattedOrders,
        submitted: isFinalSubmission,
      };

      if (game.current_phase === "retreat") {
        const sourcePhase = game.game_state?.phase_after_retreat === "fall" ? "spring" : "fall";
        filter.source_phase = sourcePhase;
        moveData.source_phase = sourcePhase;
      }

      const existingMoves = await GameMove.filter(filter);

      if (existingMoves.length > 0) {
        await GameMove.update(existingMoves[0].id, moveData);
      } else {
        await GameMove.create({
          game_id: effectiveId(),
          player_email: user.email,
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
      throw error;
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
        alert("Game state not fully loaded. Cannot unsubmit orders.");
        return;
      }

      const filterOptions = {
        game_id: effectiveId(),
        player_email: user.email,
        turn_number: game.current_turn,
        phase: game.current_phase,
      };

      if (game.current_phase === "retreat") {
        const sourcePhase = game.game_state?.phase_after_retreat === "fall" ? "spring" : "fall";
        filterOptions.source_phase = sourcePhase;
      }

      const existingMoves = await GameMove.filter(filterOptions);

      if (existingMoves.length > 0) {
        await GameMove.update(existingMoves[0].id, { submitted: false, orders: [] });
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

  const handleOpenChat = () => {
    setShowChat(true);
    setHasUnreadMessages(false);
    const gid = effectiveId();
    if (chatMessages.length > 0 && gid) {
      localStorage.setItem(`lastRead_${gid}`, chatMessages[chatMessages.length - 1].created_date);
    } else if (gid) {
      localStorage.setItem(`lastRead_${gid}`, new Date().toISOString());
    }
  };

  const getDisplayYear = (turn /*, phase */) => {
    const baseYear = 1901;
    return baseYear + (turn - 1);
  };

  const formatPhaseDisplay = (turn, phase) => {
    const year = getDisplayYear(turn, phase);
    const capitalizedPhase = phase.charAt(0).toUpperCase() + phase.slice(1);
    if (phase === "retreat") {
      const originalPhase = game.game_state?.phase_after_retreat;
      const originalPhaseCapitalized = originalPhase ? originalPhase.charAt(0).toUpperCase() + originalPhase.slice(1) : "";
      return `${originalPhaseCapitalized} ${year} Retreats`;
    }
    return `${capitalizedPhase} ${year}`;
  };

  // Reload button handler
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onReload = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await loadGameData();
      await loadChatMessages();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadGameData, loadChatMessages]);

  // Initial load & when id changes
  useEffect(() => {
    loadGameData();
    loadChatMessages();
  }, [effectiveGameId, loadGameData, loadChatMessages]);

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
                <span>{formatPhaseDisplay(game.current_turn, game.current_phase)}</span>
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
              {hasUnreadMessages && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>}
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
            {game.status === "completed" && showVictoryOverlay && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -50 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <Card className="text-center p-8 max-w-md relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowVictoryOverlay(false)}
                      className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <CardHeader>
                      <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
                        <Crown className="w-8 h-8 text-white" />
                      </div>
                      <CardTitle className="text-2xl">
                        {game.winners?.length > 1 ? "Diplomatic Draw!" : "Victory Achieved!"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {game.winners?.length > 1 ? (
                        <div>
                          <p className="mb-4 text-slate-600">The remaining powers have agreed to a diplomatic draw:</p>
                          <div className="flex justify-center gap-2 flex-wrap mb-4">
                            {game.players
                              .filter((p) => game.winners.includes(p.email))
                              .map((p) => (
                                <Badge key={p.email} style={{ backgroundColor: p.color }} className="text-white text-sm px-3 py-1 shadow">
                                  {p.country}
                                </Badge>
                              ))}
                          </div>
                          <p className="text-sm text-slate-500 italic">
                            "In diplomacy, sometimes the greatest victory is knowing when to share power."
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-slate-600 mb-2">
                            <span
                              className="font-bold text-xl"
                              style={{ color: game.players?.find((p) => p.country === game.winner_country)?.color }}
                            >
                              {game.winner_country}
                            </span>{" "}
                            has conquered Europe!
                          </p>
                          <p className="text-sm text-slate-500 italic mb-4">
                            "Through cunning diplomacy and strategic brilliance, a new empire rises."
                          </p>
                        </div>
                      )}
                      <div className="flex gap-3 justify-center">
                        <Button variant="outline" onClick={() => setShowVictoryOverlay(false)}>
                          Continue Viewing
                        </Button>
                        <Link to={createPageUrl("GameLobby")}>
                          <Button size="lg" className="bg-gradient-to-r from-blue-600 to-blue-700">
                            Return to Lobby
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Player Panel as Overlay */}
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
                  setGame((prev) => ({ ...prev, draw_votes: newVotes }));
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

      {/* Chat Panel as Overlay */}
      {showChat && (
        <motion.div
          initial={isMobile ? { y: "100%" } : { x: "100%" }}
          animate={{ y: 0, x: 0 }}
          exit={isMobile ? { y: "100%" } : { x: "100%" }}
          transition={{ type: "spring", stiffness: 350, damping: 40 }}
          className="fixed inset-0 z-50 md:absolute md:inset-y-0 md:right-0 md:w-96 md:max-w/full bg-white md:border-l md:border-slate-200 md:shadow-xl"
        >
          <GameChat game={game} user={user} messages={chatMessages} onSendMessage={async (message, threadId, participants) => {
            try {
              const userCountry = game.players?.find((p) => p.email === user.email)?.country;
              await ChatMessage.create({
                game_id: effectiveId(),
                thread_id: threadId,
                thread_participants: participants,
                sender_email: user.email,
                sender_country: userCountry,
                message,
              });
              loadChatMessages();
            } catch (error) {
              console.error("Error sending message:", error);
            }
          }} onClose={() => setShowChat(false)} />
        </motion.div>
      )}
    </div>
  );
}
