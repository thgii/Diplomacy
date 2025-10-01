import React, { useState, useEffect, useCallback } from "react";
import { Game } from "@/api/entities";
import { User } from "@/api/entities";
import { ChatMessage } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Crown, Plus, Clock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import GameCard from "../components/lobby/GameCard";
import {
  getCountryColor,
  allPowers,
  initialUnits,
  getInitialSupplyCenters,
  territories,
} from "../components/game/mapData";

export default function GameLobby() {
  const [games, setGames] = useState([]);
  const [myGames, setMyGames] = useState([]);
  const activeMyGames = myGames.filter((g) => g.status !== "completed");
  const pastGames = myGames.filter((g) => g.status === "completed");

  const [user, setUser] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("my-games");

  const navigate = useNavigate();

  const initializeGameState = () => {
    const initialSupplyCenters = {};
    Object.entries(territories).forEach(([tid, t]) => {
      if (t.supply_center && t.initial_owner) initialSupplyCenters[tid] = t.initial_owner;
    });
    return {
      territories,
      units: [],
      supply_centers: initialSupplyCenters,
    };
  };

  const loadData = useCallback(async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      if (!currentUser) {
        navigate(createPageUrl("login"));
        return;
      }

      const allGames = await Game.list("-created_date");

      const availableGames = (allGames || []).filter(
        (g) => g.status === "waiting" && !g.players?.some((p) => p.email === currentUser.email)
      );

      let userGames = (allGames || []).filter((g) =>
        g.players?.some((p) => p.email === currentUser.email)
      );

      // enrich “hasChanged” using last seen state + latest chat
      const lastGameStates = JSON.parse(localStorage.getItem("lastGameStates") || "{}");

      const gameMessagePromises = userGames.map(async (g) => {
        try {
          const latest = await ChatMessage.filter({ game_id: g.id }, "-created_date", 1);
          return { gameId: g.id, latestMessageTime: latest?.[0]?.created_date || null };
        } catch {
          return { gameId: g.id, latestMessageTime: null };
        }
      });

      const messageResults = await Promise.all(gameMessagePromises);
      const msgMap = new Map(messageResults.map((r) => [r.gameId, r.latestMessageTime]));

      const newGameStates = {};
      const updatedUserGames = userGames.map((g) => {
        const prev = lastGameStates[g.id];
        const currentMessageTime = msgMap.get(g.id);
        let hasChanged = false;

        if (prev) {
          if (prev.phase !== g.current_phase || prev.turn !== g.current_turn || prev.status !== g.status) {
            hasChanged = true;
          }
          if (currentMessageTime && (!prev.lastMessageTime || new Date(currentMessageTime) > new Date(prev.lastMessageTime))) {
            hasChanged = true;
          }
        }

        newGameStates[g.id] = {
          phase: g.current_phase,
          turn: g.current_turn,
          status: g.status,
          lastMessageTime: currentMessageTime,
        };
        return { ...g, hasChanged };
      });

      localStorage.setItem("lastGameStates", JSON.stringify(newGameStates));

      setGames(availableGames);
      setMyGames(updatedUserGames);
    } catch (err) {
      console.error("Error loading data:", err);
      navigate(createPageUrl("login"));
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateGame = async (gameData) => {
    try {
      const current = await User.me();
      if (!current) {
        navigate(createPageUrl("login"));
        return;
      }

      let selectedCountry = gameData.selectedCountry;
      if (gameData.random_assignment) {
        const taken = new Set((gameData.players || []).map((p) => p.country).filter(Boolean));
        const available = (allPowers || []).filter((c) => !taken.has(c));
        selectedCountry = available[Math.floor(Math.random() * available.length)];
      }

      const newGame = await Game.create({
        name: gameData.name,
        host_email: current.email,
        max_players: 7,
        turn_length_hours: gameData.turn_length_hours,
        auto_adjudicate: gameData.auto_adjudicate,
        random_assignment: gameData.random_assignment,
        phase_deadline: null,
        players: [
          {
            email: current.email,
            country: selectedCountry,
            color: getCountryColor(selectedCountry),
            supply_centers: 3,
            is_dummy: false,
          },
        ],
        game_state: initializeGameState(),
        draw_votes: [],
        winners: [],
      });

      setShowCreateDialog(false);
      // 🔑 Always include ?gameId= when navigating
      navigate(createPageUrl(`GameBoard?gameId=${encodeURIComponent(newGame.id)}`));
    } catch (e) {
      console.error("Error creating game:", e);
    }
  };

  const handleJoinGame = async (game, selectedCountry) => {
    try {
      const me = await User.me();
      if (!me) {
        navigate(createPageUrl("login"));
        return;
      }

      const currentPlayers = Array.isArray(game.players) ? [...game.players] : [];
      const taken = new Set(currentPlayers.map((p) => p?.country).filter(Boolean));
      const available = (allPowers || []).filter((c) => !taken.has(c));

      let assignedCountry = selectedCountry || null;

      if (game.random_assignment) {
        if (available.length === 0) {
          alert("All countries are already taken.");
          return;
        }
        assignedCountry = available[Math.floor(Math.random() * available.length)];
      } else {
        if (!assignedCountry) {
          alert("Please select a country to join.");
          return;
        }
        if (taken.has(assignedCountry)) {
          alert(`${assignedCountry} is already taken.`);
          return;
        }
      }

      const newPlayer = {
        email: me.email,
        country: assignedCountry,
        color: getCountryColor(assignedCountry),
        supply_centers: 3,
        is_dummy: false,
        joined_at: new Date().toISOString(),
      };

      const updatedPlayers = [...currentPlayers, newPlayer];
      const fillsTable = updatedPlayers.length >= (game.max_players || 7);

      const patch = {
        players: updatedPlayers,
        status: fillsTable ? "in_progress" : "waiting",
      };

      if (fillsTable) {
        // set deadline
        const h = game.turn_length_hours ?? 24;
        const d = new Date();
        d.setHours(d.getHours() + h);
        patch.phase_deadline = d.toISOString();

        // seed starting units
        const startingUnits = [];
        const usedIds = new Set();
        const makeId = (country, territory, type) => {
          const base = `${String(country).toUpperCase()}-${String(territory).toUpperCase()}-${String(type).toUpperCase()}`;
          if (!usedIds.has(base)) {
            usedIds.add(base);
            return base;
          }
          let i = 2;
          let candidate = `${base}#${i}`;
          while (usedIds.has(candidate)) {
            i += 1;
            candidate = `${base}#${i}`;
          }
          usedIds.add(candidate);
          return candidate;
        };

        updatedPlayers.forEach((p) => {
          const starts = initialUnits[p.country] || [];
          starts.forEach((u) => {
            const id = makeId(p.country, u.territory, u.type);
            startingUnits.push({
              id,
              type: u.type,
              territory: u.territory,
              country: p.country,
              home: u.territory,
              origin: u.territory,
            });
          });
        });

        const initialSC = getInitialSupplyCenters();

        patch.current_turn = 1;
        patch.current_phase = "spring";
        patch.game_state = {
          ...(game.game_state || {}),
          units: startingUnits,
          supply_centers: initialSC,
          last_turn_results: null,
          pending_retreats: [],
        };
      }

      await Game.update(game.id, patch);

      // go straight to the board for that specific game id
      navigate(createPageUrl(`GameBoard?gameId=${encodeURIComponent(game.id)}`));
    } catch (e) {
      console.error("Error joining game:", e);
    }
  };

  const handleDeleteGame = async (gameId) => {
    try {
      await Game.delete(gameId);
      loadData();
    } catch (e) {
      console.error("Error deleting game:", e);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 space-y-4">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                <div className="h-3 bg-slate-200 rounded"></div>
                <div className="h-3 bg-slate-200 rounded w-5/6"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Diplomatic Arena</h1>
          <p className="text-slate-600 text-lg">Join the ultimate game of negotiation and strategy</p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Game
        </Button>
      </div>

      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setActiveTab("available")}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
            activeTab === "available" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          Available Games ({games.length})
        </button>
        <button
          onClick={() => setActiveTab("my-games")}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
            activeTab === "my-games" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          Active Games ({activeMyGames.length})
        </button>
        <button
          onClick={() => setActiveTab("past")}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
            activeTab === "past" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          Past Games ({pastGames.length})
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "available" && (
          <motion.div key="available" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            {games.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    type="available"
                    user={user}
                    getCountryColor={getCountryColor}
                    onJoin={handleJoinGame}
                    onDelete={handleDeleteGame}
                    onOpenBoard={(g) => navigate(createPageUrl(`GameBoard?gameId=${encodeURIComponent(g.id)}`))}
                  />
                ))}
              </div>
            ) : (
              <Card className="text-center py-12 bg-gradient-to-br from-slate-50 to-slate-100 border-dashed">
                <CardContent>
                  <Crown className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">No Available Games</h3>
                  <p className="text-slate-500 mb-6">Be the first to create a diplomatic challenge!</p>
                  <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Game
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {activeTab === "my-games" && (
          <motion.div key="my-games" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            {activeMyGames.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeMyGames.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    type="my-game"
                    user={user}
                    getCountryColor={getCountryColor}
                    hasChanged={game.hasChanged}
                    onDelete={handleDeleteGame}
                    onOpenBoard={(g) => navigate(createPageUrl(`GameBoard?gameId=${encodeURIComponent(g.id)}`))}
                  />
                ))}
              </div>
            ) : (
              <Card className="text-center py-12 bg-gradient-to-br from-slate-50 to-slate-100 border-dashed">
                <CardContent>
                  <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">No Games Yet</h3>
                  <p className="text-slate-500 mb-6">Start your diplomatic journey by creating or joining a game!</p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700">
                      Create Game
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab("available")}>
                      Browse Games
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {activeTab === "past" && (
          <motion.div key="past" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            {pastGames.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastGames.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    type="my-game"
                    user={user}
                    getCountryColor={getCountryColor}
                    hasChanged={false}
                    onDelete={handleDeleteGame}
                    onOpenBoard={(g) => navigate(createPageUrl(`GameBoard?gameId=${encodeURIComponent(g.id)}`))}
                  />
                ))}
              </div>
            ) : (
              <Card className="text-center py-12 bg-gradient-to-br from-slate-50 to-slate-100 border-dashed">
                <CardContent>
                  <Clock className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">No Past Games</h3>
                  <p className="text-slate-500">Finished games will appear here automatically.</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* CreateGameDialog remains unchanged if you have it in your project */}
      {/* <CreateGameDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} onCreate={handleCreateGame} /> */}
    </div>
  );
}
