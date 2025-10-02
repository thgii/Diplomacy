
import React, { useState, useEffect, useCallback } from "react";
import { Game } from "@/api/entities";
import { User } from "@/api/entities";
import { ChatMessage } from "@/api/entities"; // Added ChatMessage import
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Users, Clock, Crown, Play, Eye } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { getCountryColor, allPowers, initialUnits, getInitialSupplyCenters } from "../components/game/mapData";
import CreateGameDialog from "../components/lobby/CreateGameDialog";
import GameCard from "../components/lobby/GameCard";
import { territories, homeSupplyCenters } from "../components/game/mapData";

export default function GameLobby() {
  const [games, setGames] = useState([]);
  const [myGames, setMyGames] = useState([]);
  // Derived lists for tabs
  const activeMyGames = myGames.filter(g => g.status !== "completed");
  const pastGames = myGames.filter(g => g.status === "completed");

  const [user, setUser] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("my-games"); // Changed default from "available" to "my-games"

  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      
      // If no current user is returned, redirect to the login page.
      // This handles cases where the user is not authenticated or their session expired.
      if (!currentUser) {
        navigate(createPageUrl("login")); 
        return; // Stop execution as user needs to log in
      }

      const allGames = await Game.list("-created_date");
      const availableGames = allGames.filter(game => 
        game.status === "waiting" && 
        !game.players?.some(p => p.email === currentUser.email)
      );
      
      let userGames = allGames.filter(game => 
        game.players?.some(p => p.email === currentUser.email)
      );
      
      // Load previous game states from localStorage
      const lastGameStatesString = localStorage.getItem('lastGameStates');
      const lastGameStates = lastGameStatesString ? JSON.parse(lastGameStatesString) : {};

      // Fetch latest message for each user game concurrently
      const gameMessagePromises = userGames.map(async (game) => {
        try {
            const msgs = await ChatMessage.filter({ game_id: game.id });
            // API returns oldest→newest, so the latest is the last element
            const last = msgs.length ? msgs[msgs.length - 1] : null;
            const latestMessageTime =
              last?.created_date ?? last?.created_at ?? null;
            return { gameId: game.id, latestMessageTime };
        } catch (error) {
            console.error(`Error fetching messages for game ${game.id}:`, error);
            return { gameId: game.id, latestMessageTime: null }; // Return null on error
        }
      });

      const messageResults = await Promise.all(gameMessagePromises);
      const gameToMessageMap = new Map(messageResults.map(res => [res.gameId, res.latestMessageTime]));

      // Prepare new game states and mark changes for myGames
      const newGameStates = {};
      const updatedUserGames = userGames.map(game => { // Use map to create a new array with `hasChanged` flag
        const prevGameState = lastGameStates[game.id];
        let hasChanged = false;
        const currentMessageTime = gameToMessageMap.get(game.id);

        // Check for changes in phase, turn, or status
        // Note: game.current_phase and game.current_turn are assumed to exist on the Game entity
        if (prevGameState) {
          if (prevGameState.phase !== game.current_phase ||
              prevGameState.turn !== game.current_turn ||
              prevGameState.status !== game.status) {
            hasChanged = true;
          }
          // Check for new messages
          // Only mark hasChanged if currentMessageTime exists AND is newer than prev.lastMessageTime
          // Or if prev.lastMessageTime didn't exist but currentMessageTime does (new message for a tracked game)
          if (currentMessageTime && (!prevGameState.lastMessageTime || new Date(currentMessageTime) > new Date(prevGameState.lastMessageTime))) {
            hasChanged = true;
          }
        }
        // If there's no previous state, we don't automatically mark it as changed based on existing messages.
          // Seed baseline "last read" on the user's very first lobby load for this game.
  // This prevents a phantom "New Messages" badge when there is historical chat.
  if (!prevGameState && currentMessageTime) {
    try {
      const readerId = (currentUser?.id ?? currentUser?.email ?? "").toString();
      if (readerId) {
        const lrKey = `chat:lastRead:${game.id}:${readerId}`;
        let obj = {};
        try { obj = JSON.parse(localStorage.getItem(lrKey) || "{}"); } catch {}
        const curMs = new Date(currentMessageTime).getTime();
        obj.__all__ = Math.max(Number(obj.__all__ || 0), curMs);
        localStorage.setItem(lrKey, JSON.stringify(obj));
      }
    } catch {
      // no-op; keep lobby resilient
    }
  }
        

// It will be marked as changed when a new update (including a new message) occurs *after* this load.
        
        // Store current state for future comparison
        newGameStates[game.id] = {
          phase: game.current_phase,
          turn: game.current_turn,
          status: game.status,
          lastMessageTime: currentMessageTime, // Store the latest message time
        };

        return { ...game, hasChanged }; // Add the hasChanged flag to the game object
      });

      // Save the *new* game states to localStorage for the next load
      localStorage.setItem('lastGameStates', JSON.stringify(newGameStates));

      setGames(availableGames);
      setMyGames(updatedUserGames); // Use the updated user games
    } catch (error) {
      console.error("Error loading data:", error);
      // In case of an error (e.g., network issue, authentication failure from backend),
      // also redirect to login. A more sophisticated app might show an error message.
      navigate(createPageUrl("login"));
    } finally {
      setLoading(false);
    }
  }, [navigate]); // navigate is a stable function from useNavigate, so it's safe to include

  useEffect(() => {
    loadData();
  }, [loadData]); // loadData is now memoized by useCallback, satisfying the dependency array

  const handleCreateGame = async (gameData) => {
    try {
      let selectedCountry = gameData.selectedCountry;
      
      // Handle random assignment if enabled
      if (gameData.random_assignment) {
        const availableCountries = (allPowers || []).filter(country => 
          !gameData.players?.some(p => p.country === country)
        );
        selectedCountry = availableCountries[Math.floor(Math.random() * availableCountries.length)];
      }

      

      const newGame = await Game.create({
        name: gameData.name, // Explicitly passed from gameData
        host_email: user.email,
        host_id: user.id,
        max_players: 7, // Always 7 players
        turn_length_hours: gameData.turn_length_hours, // Explicitly passed from gameData
        auto_adjudicate: gameData.auto_adjudicate, // Explicitly passed from gameData
        random_assignment: gameData.random_assignment, // Explicitly passed from gameData
        phase_deadline: null,
        players: [{
          email: user.email,
          country: selectedCountry,
          color: getCountryColor(selectedCountry),
          supply_centers: 3,
          is_dummy: false // New property for player type
        }],
        game_state: initializeGameState(),
        draw_votes: [],
        winners: []
      });
      
      setShowCreateDialog(false);
      // Redirect to the newly created game
      navigate(createPageUrl("GameBoard", { gameId: newGame.id }));
    } catch (error) {
      console.error("Error creating game:", error);
    }
  };

  const handleJoinGame = async (game, selectedCountry) => {
    try {
      const currentPlayers = Array.isArray(game.players) ? [...game.players] : [];

      // Build taken/available country sets
      const taken = new Set(currentPlayers.map(p => p?.country).filter(Boolean));
      const available = (allPowers || []).filter(c => !taken.has(c));

      // Decide the assignment for THIS player now (no reshuffle later)
      let assignedCountry = selectedCountry || null;

      if (game.random_assignment) {
        if (available.length === 0) {
          alert("All countries are already taken.");
          return;
        }
        assignedCountry = available[Math.floor(Math.random() * available.length)];
      } else {
        // Non-random lobbies still respect a picker from the card (selectedCountry)
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
        email: user.email,
        country: assignedCountry,
        color: getCountryColor(assignedCountry),
        supply_centers: 3,
        is_dummy: false,
        joined_at: new Date().toISOString(),
      };

      const updatedPlayers = [...currentPlayers, newPlayer];
      const fillsTable = updatedPlayers.length >= (game.max_players || 7);

      // IMPORTANT: No reshuffle. When the table fills, just start the game and set the first deadline.
      const patch = {
        players: updatedPlayers,
        status: fillsTable ? "in_progress" : "waiting",
      };

      if (fillsTable) {
        // 1) Set the first deadline
        const h = game.turn_length_hours ?? 24;
        const d = new Date();
        d.setHours(d.getHours() + h);
        patch.phase_deadline = d.toISOString();

        // 2) Build starting units for each seated player
        const startingUnits = [];
        const usedIds = new Set();

        const makeId = (country, territory, type) => {
          // Keep it simple but collision-safe
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
      
        // 3) Initial supply center ownership (from map data’s initial_owner)
        const initialSC = getInitialSupplyCenters();
      
        // 4) Seed game state & the phase/turn
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
      loadData();
    } catch (error) {
      console.error("Error joining game:", error);
    }
  };



  const handleDeleteGame = async (gameId) => {
    try {
      await Game.delete(gameId);
      loadData(); // Reload the game lists
    } catch (error) {
      console.error("Error deleting game:", error);
    }
  };


  const initializeGameState = () => {
    // Initialize supply center ownership based on initial_owner from territories data
    const initialSupplyCenters = {};
    Object.entries(territories).forEach(([terrId, terrData]) => {
      if (terrData.supply_center && terrData.initial_owner) {
        initialSupplyCenters[terrId] = terrData.initial_owner;
      }
    });

    return {
      territories: territories, // Include the full map data
      units: [],
      supply_centers: initialSupplyCenters
    };
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-4">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-3 bg-slate-200 rounded"></div>
                  <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                </div>
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
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Diplomatic Arena
          </h1>
          <p className="text-slate-600 text-lg">
            Join the ultimate game of negotiation and strategy
          </p>
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
            activeTab === "available"
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          Available Games ({games.length})
        </button>

        <button
          onClick={() => setActiveTab("my-games")}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
            activeTab === "my-games"
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          Active Games ({activeMyGames.length})
        </button>

        <button
          onClick={() => setActiveTab("past")}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
            activeTab === "past"
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          Past Games ({pastGames.length})
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "available" && (
          <motion.div
            key="available"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {games.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onJoin={handleJoinGame}
                    onDelete={handleDeleteGame}
                    user={user}
                    getCountryColor={getCountryColor}
                    type="available"
                  />
                ))}
              </div>
            ) : (
              <Card className="text-center py-12 bg-gradient-to-br from-slate-50 to-slate-100 border-dashed">
                <CardContent>
                  <Crown className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">No Available Games</h3>
                  <p className="text-slate-500 mb-6">Be the first to create a diplomatic challenge!</p>
                  <Button 
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
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
                    onDelete={handleDeleteGame}
                    user={user}
                    getCountryColor={getCountryColor}
                    type="my-game"
                    hasChanged={game.hasChanged}
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
                    <Button 
                      onClick={() => setShowCreateDialog(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Create Game
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setActiveTab("available")}
                    >
                      Browse Games
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
        {activeTab === "past" && (
          <motion.div
            key="past"
            initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {pastGames.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastGames.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onDelete={handleDeleteGame}
                    user={user}
                    getCountryColor={getCountryColor}
                    // You can reuse "my-game" so buttons/labels behave;
                    // or set type="past" and add a tiny tweak in GameCard (see Optional step below).
                    type="my-game"
                    hasChanged={false}
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

      <CreateGameDialog 
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateGame}
      />
    </div>
  );
}
