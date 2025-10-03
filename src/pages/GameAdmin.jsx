import React, { useState, useEffect, useCallback } from "react";
import { Game } from "@/api/entities";
import { User } from "@/api/entities"; // Corrected import based on outline
import { GameMove } from "@/api/entities"; // Added import for GameMove
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getCountryColor, allPowers, initialUnits } from "../components/game/mapData"; // ⬅️ add initialUnits
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Settings,
  UserPlus,
  Crown,
  Trash2,
  Play,
  Users,
  ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

const COUNTRIES = [
  "Austria-Hungary", "England", "France", "Germany", "Italy", "Russia", "Turkey"
];

const COUNTRY_COLORS = {
  "Austria-Hungary": "#8B4513", // brown
  "England": "#6f00ff", // dark purple
  "France": "#87ceeb", // light blue
  "Germany": "#333333", // dark gray
  "Italy": "#22c55e", // green
  "Russia": "#d1d5db", // light gray
  "Turkey": "#eab308" // yellow
};

/* -------------------------- Helpers for 2A / 2B -------------------------- */

// Fisher–Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Assign any players missing a country if random_assignment is true
function assignMissingCountries(players, randomAssignment) {
  const assigned = new Set(players.map(p => p.country).filter(Boolean));
  const pool = allPowers.filter(c => !assigned.has(c));
  const shuffled = shuffle(pool);
  let idx = 0;

  const nextPlayers = players.map(p => {
    if (p.country || !randomAssignment) return p;
    const country = shuffled[idx++] || null;
    if (!country) return p; // ran out of countries
    return {
      ...p,
      country,
      color: getCountryColor(country),
      // keep their supply_centers or default to 3
      supply_centers: typeof p.supply_centers === "number" ? p.supply_centers : 3,
    };
  });

  return nextPlayers;
}

// Build unique unit IDs to avoid collisions
function makeUnitIdFactory(existingUnits = []) {
  const used = new Set((existingUnits || []).map(u => u.id));
  return (country, territory, type) => {
    const base = `${country}-${territory}-${type}`.toUpperCase();
    if (!used.has(base)) {
      used.add(base);
      return base;
    }
    let n = 2;
    while (used.has(`${base}-${n}`)) n++;
    const id = `${base}-${n}`;
    used.add(id);
    return id;
  };
}

// Seed starting units for all players with a country
function seedStartingUnits(players, currentUnits = []) {
  const makeId = makeUnitIdFactory(currentUnits);
  const starting = [];

  players.forEach(p => {
    if (!p.country) return;
    const starts = initialUnits[p.country] || [];
    starts.forEach(u => {
      starting.push({
        id: makeId(p.country, u.territory, u.type),
        country: p.country,
        type: u.type,
        territory: u.territory,
        home: u.territory,
        origin: u.territory,
      });
    });
  });

  return starting;
}

/* ----------------------------------------------------------------------- */

export default function GameAdmin() {
  const [game, setGame] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerData, setNewPlayerData] = useState({ country: "", isDummy: false });

  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('gameId');

  const loadGameData = useCallback(async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const gameData = await Game.filter({ id: gameId });
      if (gameData.length > 0) {
        setGame(gameData[0]);
      }
    } catch (error) {
      console.error("Error loading game data:", error);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    loadGameData();
  }, [gameId, loadGameData]);

  const isAdmin = user?.role === "admin";

  const isGameHost = () => {
    return user && game && game.host_email === user.email;
  };

  const addDummyPlayer = async () => {
    if (!newPlayerData.country) return;

    try {
      const updatedPlayers = [...(game.players || []), {
        email: `dummy_${Date.now()}@example.com`,
	nickname: "Dummy Player",
        // placeholder; will be overwritten if we fill the table
        country: newPlayerData.country,
        color: getCountryColor(newPlayerData.country),
        supply_centers: 3,
        is_dummy: true
      }];

      const fillsTable = updatedPlayers.length === game.max_players;

      if (fillsTable) {
        const powers = shuffle(allPowers);
        const assignedPlayers = updatedPlayers.map((p, i) => ({
          ...p,
          country: powers[i],
          color: getCountryColor(powers[i])
        }));

        await Game.update(game.id, {
          players: assignedPlayers,
          status: "in_progress"
        });

        setGame({ ...game, players: assignedPlayers, status: "in_progress" });
      } else {
        await Game.update(game.id, {
          players: updatedPlayers,
          status: game.status
        });

        setGame({ ...game, players: updatedPlayers });
      }

      setShowAddPlayer(false);
      setNewPlayerData({ country: "", isDummy: false });
    } catch (error) {
      console.error("Error adding dummy player:", error);
    }
  };


  const removePlayer = async (playerToRemove) => {
    try {
      const updatedPlayers = game.players.filter(p => p.email !== playerToRemove.email);

      await Game.update(game.id, {
        players: updatedPlayers,
        status: updatedPlayers.length < game.max_players ? "waiting" : game.status
      });

      setGame({ ...game, players: updatedPlayers });
    } catch (error) {
      console.error("Error removing player:", error);
    }
  };

  const resolveOrders = async () => {
    try {
      // Get all moves for this turn/phase
      const allMoves = await GameMove.filter({
        game_id: game.id,
        turn_number: game.current_turn,
        phase: game.current_phase
      });

      // Start with current unit positions
      let newUnits = [...(game.game_state?.units || [])];

      // Process move orders (simplified resolution for now)
      allMoves.forEach(move => {
        move.orders.forEach(order => {
          if (order.action === 'move') {
            const unitIndex = newUnits.findIndex(u => u.id === order.unit_id);
            if (unitIndex !== -1) {
              newUnits[unitIndex] = {
                ...newUnits[unitIndex],
                territory: order.target
              };
            }
          }
          // Add logic for other order types (support, convoy, hold, etc.)
        });
      });

      return newUnits;
    } catch (error) {
      console.error("Error resolving orders:", error);
      return game.game_state?.units || []; // Return current units if resolution fails
    }
  };

  const advancePhase = async () => {
    try {
      // Resolve orders and move units
      const newUnits = await resolveOrders();

      const phases = ["spring", "fall", "winter"];
      const currentPhaseIndex = phases.indexOf(game.current_phase);
      const nextPhaseIndex = (currentPhaseIndex + 1) % phases.length;
      const nextPhase = phases[nextPhaseIndex];
      const nextTurn = nextPhase === "spring" ? game.current_turn + 1 : game.current_turn;

      await Game.update(game.id, {
        current_phase: nextPhase,
        current_turn: nextTurn,
        game_state: {
          ...game.game_state,
          units: newUnits
        }
      });

      setGame({
        ...game,
        current_phase: nextPhase,
        current_turn: nextTurn,
        game_state: {
          ...game.game_state,
          units: newUnits
        }
      });

      alert(`Phase advanced to ${nextPhase} ${nextTurn}`);
    } catch (error) {
      console.error("Error advancing phase:", error);
    }
  };


  const updateGameSettings = async (updates) => {
    try {
      let next = { ...updates };
      let nextPlayers = game.players ? [...game.players] : [];
      let nextGameState = { ...(game.game_state || {}) };

      // 2A: When switching to in_progress, start the clock
      if (next.status === "in_progress" && game.status !== "in_progress") {
        const h = (typeof next.turn_length_hours === "number"
          ? next.turn_length_hours
          : game.turn_length_hours) ?? 24;
        const d = new Date();
        d.setHours(d.getHours() + h);
        next.phase_deadline = d.toISOString();

        // 2B: Force-assign any players with no country if random_assignment is true
        const randomAssignment = !!game.random_assignment;
        nextPlayers = assignMissingCountries(nextPlayers, randomAssignment);

        // 2A: Seed starting units if none exist yet
        const hasUnits = Array.isArray(nextGameState.units) && nextGameState.units.length > 0;
        if (!hasUnits) {
          const seeded = seedStartingUnits(nextPlayers, nextGameState.units);
          nextGameState = {
            ...nextGameState,
            units: seeded,
            // keep any existing mappings; otherwise leave as is (index.js already wrote defaults)
            supply_centers: (nextGameState.supply_centers && typeof nextGameState.supply_centers === "object")
              ? nextGameState.supply_centers
              : {},
            last_turn_results: nextGameState.last_turn_results ?? null,
            pending_retreats: Array.isArray(nextGameState.pending_retreats) ? nextGameState.pending_retreats : [],
          };
          next.game_state = nextGameState;
        }

        // Persist possibly updated players (due to assignment)
        next.players = nextPlayers;
      }

      // If host sets status back to waiting, clear the clock (no unit changes)
      if (next.status === "waiting") {
        next.phase_deadline = null;
      }

      // Persist
      await Game.update(game.id, next);

      // Update local state mirror
      setGame({
        ...game,
        ...next,
        players: next.players ?? game.players,
        game_state: next.game_state ? next.game_state : game.game_state,
      });
    } catch (error) {
      console.error("Error updating game settings:", error);
    }
  };


  const availableCountries = COUNTRIES.filter(country =>
    !game?.players?.some(p => p.country === country)
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-slate-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!game || !(isAdmin || isGameHost())) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Card className="text-center p-8">
          <CardContent>
            <h2 className="text-xl font-semibold text-slate-700 mb-4">Access Denied</h2>
            <p className="text-slate-500 mb-6">Only the game host or an admin can access admin controls.</p>
            <Link to={createPageUrl("GameLobby")}>
              <Button>Return to Lobby</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

const displayName = (player) => {
  if (player.is_dummy) return "Dummy Player";
  return (
    player.nickname                              // if ever present on player
    || (user && player.email === user.email && user.nickname) // current user's nickname from session
    || player.username                           // in case you ever have this
    || (player.email?.split?.("@")?.[0] ?? "")   // optional: show local-part as a friendlier label
    || player.email
  );
};

  return (
    <div className="relative min-h-screen overflow-hidden"> {/* Added relative container for background */}
      {/* Background Map Image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: "url('/assets/diplomacy_map_borders.png')" }} // Path to your Diplomacy map image
      ></div>

      {/* Main Content, placed above the background */}
      <div className="relative z-10 p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl(`GameBoard?gameId=${game.id}`)}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Game Administration</h1>
              <p className="text-slate-600">{game.name}</p>
            </div>
          </div>
          <Badge className={`text-sm ${
            game.status === "waiting" ? "bg-yellow-100 text-yellow-800" :
            game.status === "in_progress" ? "bg-green-100 text-green-800" :
            "bg-gray-100 text-gray-800"
          }`}>
            {game.status === "waiting" ? "Recruiting" :
             game.status === "in_progress" ? "Active" : "Completed"}
          </Badge>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Game Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Game Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Phase Control */}
              <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Current Phase</span>
                  <Badge variant="outline" className="capitalize">
                    {game.current_phase} {game.current_turn}
                  </Badge>
                </div>
                <Button
                  onClick={advancePhase}
                  className="w-full"
                  disabled={game.status !== "in_progress"}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Advance to Next Phase
                </Button>
              </div>

              {/* Game Status Control */}
              <div className="space-y-2">
                <Label className="font-medium">Game Status</Label>
                <Select
                  value={game.status}
                  onValueChange={(value) => updateGameSettings({ status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="waiting">Waiting for Players</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Turn Settings */}
              <div className="space-y-2">
                <Label className="font-medium">Turn Length (Hours)</Label>
                <Select
                  value={game.turn_length_hours?.toString() || "24"}
                  onValueChange={(value) => updateGameSettings({ turn_length_hours: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="48">48 hours</SelectItem>
                    <SelectItem value="72">72 hours</SelectItem>
                    <SelectItem value="168">1 week</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-adjudicate setting */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoAdjudicate"
                  checked={game.auto_adjudicate || false}
                  onCheckedChange={(checked) => updateGameSettings({ auto_adjudicate: checked })}
                />
                <Label htmlFor="autoAdjudicate">Auto-adjudicate on timeout</Label>
              </div>
            </CardContent>
          </Card>

          {/* Player Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Player Management
                </div>
                <Button
                  onClick={() => setShowAddPlayer(true)}
                  size="sm"
                  disabled={availableCountries.length === 0}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Player
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {game.players?.map((player) => (
                  <motion.div
                    key={player.email}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: player.color }}
                      />
                      <div>
                        <div className="font-medium">{player.country}</div>
                        <div className="text-xs text-slate-500">
                          {displayName(player)}
                        </div>
                      </div>
                      {player.email === game.host_email && (
                        <Crown className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {player.supply_centers || 3} Centers
                      </Badge>
                      {player.email !== game.host_email && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePlayer(player)}
                          className="text-red-500 hover:text-red-700 h-8 w-8"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Player Dialog */}
        <Dialog open={showAddPlayer} onOpenChange={setShowAddPlayer}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Player</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Available Nations</Label>
                <Select
                  value={newPlayerData.country}
                  onValueChange={(value) => setNewPlayerData({...newPlayerData, country: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose nation..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCountries.map((country) => (
                      <SelectItem key={country} value={country}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COUNTRY_COLORS[country] }}
                          />
                          {country}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddPlayer(false)}>
                  Cancel
                </Button>
                <Button onClick={addDummyPlayer} disabled={!newPlayerData.country}>
                  Add Dummy Player
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
