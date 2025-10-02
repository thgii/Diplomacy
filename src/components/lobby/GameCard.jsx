import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Users, Clock, Crown, Play, Eye, MessageSquare, Shuffle, Trash2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

const COUNTRIES = [
  "Austria-Hungary",
  "England", 
  "France",
  "Germany",
  "Italy",
  "Russia",
  "Turkey"
];

// Simple timer component for lobby cards
const PhaseCountdown = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(deadline).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [deadline]);

  if (!timeLeft) return null;

  return (
    <span className={`text-xs font-medium ${
      timeLeft === 'Expired' ? 'text-red-600' : 
      timeLeft.includes('h') && parseInt(timeLeft) < 2 ? 'text-orange-600' :
      'text-slate-600'
    }`}>
      {timeLeft === 'Expired' ? 'Phase Expired' : `${timeLeft} left`}
    </span>
  );
};

export default function GameCard({ game, onJoin, onDelete, user, getCountryColor, type, hasChanged }) {
  const [selectedCountry, setSelectedCountry] = useState("");
  const [joining, setJoining] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const availableCountries = COUNTRIES.filter(country => 
    !game.players?.some(p => p.country === country)
  );

  const userCountry = game.players?.find(p => p.email === user.email)?.country;
  const isAdmin = user?.role === 'admin';
  const showAssignments = game.random_assignment ? true : (game.status === "in_progress");


  // Check if game has changed since last visit
const hasGameChanged = () => {
  // Only show change pills on "my-game" cards
  if (type !== "my-game") return { phase: false, messages: false };

  try {
    const lastGameStates = JSON.parse(localStorage.getItem("lastGameStates") || "{}");
    const lastState = lastGameStates?.[game.id];

    // First time seeing this game: surface "Updated" if you want,
    // but don't show phantom "New Messages".
    if (!lastState) return { phase: true, messages: false };

    let phaseChanged = false;
    let messagesChanged = false;

    // Phase/turn/status checks
    if (
      lastState.phase !== game.current_phase ||
      lastState.turn !== game.current_turn ||
      lastState.status !== game.status
    ) {
      phaseChanged = true;
    }

    // Message badge: compare last message time vs. user's last read
    if (lastState.lastMessageTime) {
      // Read unified last-read map used by GameChat
      let lastReadTs = 0;
      try {
        const lrKey = `chat:lastRead:${game.id}:${user?.id ?? user?.email}`;
        const raw = localStorage.getItem(lrKey);
        if (raw) {
          const obj = JSON.parse(raw);
          // Prefer __all__ if present; otherwise take the max across threads
          const vals = Object.values(obj)
            .map(Number)
            .filter((n) => Number.isFinite(n));
          if (vals.length) lastReadTs = Math.max(...vals);
        }
      } catch {
        /* no-op */
      }

      const lastMsgTs = new Date(lastState.lastMessageTime).getTime();
      if (!lastReadTs || lastMsgTs > lastReadTs) {
        messagesChanged = true;
      }
    }

    // IMPORTANT: always return a result (previous code could fall through)
    return { phase: phaseChanged, messages: messagesChanged };
  } catch (err) {
    console.error("Error parsing last game states from localStorage:", err);
    return { phase: false, messages: false };
  }
};

  const gameChanges = hasGameChanged();

  const handleJoin = async () => {
    let countryToJoin = selectedCountry;
    
    // Handle random assignment
    if (game.random_assignment) {
      if (availableCountries.length > 0) {
        countryToJoin = availableCountries[Math.floor(Math.random() * availableCountries.length)];
      } else {
        // This case should ideally not happen if the UI properly reflects available slots
        console.warn("No available countries for random assignment.");
        return; 
      }
    }
    
    if (countryToJoin) {
      setJoining(true);
      await onJoin(game, countryToJoin);
      setJoining(false);
      setSelectedCountry("");
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) return;
    setDeleting(true);
    await onDelete(game.id);
    setDeleting(false);
  };

  const getStatusBadge = () => {
    if (game.status === "waiting") {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Recruiting</Badge>;
    }
    if (game.status === "in_progress") {
      return <Badge className="bg-green-100 text-green-800">In Progress</Badge>;
    }
    if (game.status === "completed") {
      if (game.winners?.length > 1) {
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Draw</Badge>;
      }
      return <Badge variant="outline" className="bg-gray-100">Completed</Badge>;
    }
    return <Badge variant="outline">Unknown</Badge>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="h-full bg-white hover:shadow-xl transition-all duration-300 border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start mb-2">
            <CardTitle className="text-lg font-bold text-slate-900 truncate pr-2">
              {game.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              {gameChanges.phase && (
                <div className="flex items-center gap-1 bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                  <AlertCircle className="w-3 h-3" />
                  Updated
                </div>
              )}
              {gameChanges.messages && (
                <div className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                  <MessageSquare className="w-3 h-3" />
                  New Messages
                </div>
              )}
              {getStatusBadge()}
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 w-7 h-7">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Game</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{game.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDelete}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={deleting}
                      >
                        {deleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{game.players?.length || 0}/{game.max_players}</span>
            </div>
            <div className="flex items-center gap-1">
              <Crown className="w-4 h-4" />
              <span>Turn {game.current_turn}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{game.turn_length_hours}h</span>
            </div>
          </div>
          
          {/* Phase Timer - only show for in-progress games */}
          {game.status === 'in_progress' && game.phase_deadline && (
            <div className="flex items-center gap-1 text-sm">
              <Clock className="w-3 h-3" />
              <PhaseCountdown deadline={game.phase_deadline} />
            </div>
          )}
          
          {game.random_assignment && (
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 w-fit">
              <Shuffle className="w-3 h-3 mr-1" />
              Random Assignment
            </Badge>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Player List */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Players</h4>
              <div className="space-y-1">
                {game.players?.map((player, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: showAssignments ? getCountryColor(player.country) : "#cbd5e1" /* slate-300 */ }}
                    />
                    <span className="font-medium text-slate-700">
                      {showAssignments ? player.country : (player.email === user.email ? "You" : "Player")}
                    </span>
                    {player.is_dummy && (
                      <Badge variant="outline" className="text-xs">AI</Badge>
                    )}
                    {player.email === user.email && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </div>
                ))}
                {Array.from({ length: game.max_players - (game.players?.length || 0) }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="flex items-center gap-2 text-sm text-slate-400">
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                    <span className="italic">Open slot</span>
                  </div>
                ))}

              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t">
              {type === "available" && (
                <div className="space-y-3">
                  {!game.random_assignment && (
                    <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Choose nation..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCountries.map((country) => (
                          <SelectItem key={country} value={country}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: getCountryColor(country) }}
                              />
                              {country}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button 
                    onClick={handleJoin}
                    disabled={(!game.random_assignment && !selectedCountry) || joining}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    {joining ? "Joining..." : game.random_assignment ? "Join (Random Nation)" : "Join Game"}
                  </Button>
                </div>
              )}
              
              {type === "my-game" && (
                <div className="flex gap-2">
                  {game.status === "in_progress" && (
                    <Link 
                      to={createPageUrl("GameBoard", { gameId: game.id })} className="flex-1">
                      <Button size="sm" className="w-full bg-green-600 hover:bg-green-700">
                        <Play className="w-4 h-4 mr-1" />
                        Play
                      </Button>
                    </Link>
                  )}
                  <Link 
                    to={createPageUrl("GameBoard", { gameId: game.id })} className="flex-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {userCountry && showAssignments && (
              <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                Playing as <span className="font-semibold">{userCountry}</span>
              </div>
            )}

          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}