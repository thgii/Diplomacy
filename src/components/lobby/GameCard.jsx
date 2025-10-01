import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Play, Trash2, Eye } from "lucide-react";

export default function GameCard({
  game,
  user,
  type = "available",          // "available" | "my-game"
  getCountryColor,
  hasChanged = false,
  onJoin,
  onDelete,
  onOpenBoard,
}) {
  const [selectedCountry, setSelectedCountry] = useState("");

  const isHost = user?.email && game?.host_email === user.email;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{game.name}</span>
          {hasChanged && (
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">
              Update
            </span>
          )}
        </CardTitle>
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span>
            {game.players?.length || 0}/{game.max_players || 7} players
          </span>
          <span>• {game.status}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Seated players */}
        <div className="flex flex-wrap gap-2">
          {(game.players || []).map((p) => (
            <span
              key={p.email}
              className="text-xs px-2 py-1 rounded text-white"
              style={{ backgroundColor: p.color || "#64748b" }}
              title={p.email}
            >
              {p.country}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {type === "available" ? (
            <>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
              >
                <option value="">Pick your country…</option>
                {["England", "France", "Germany", "Italy", "Austria-Hungary", "Russia", "Turkey"]
                  .filter((c) => !game.players?.some((p) => p.country === c))
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
              <Button
                size="sm"
                onClick={() => onJoin && onJoin(game, selectedCountry)}
              >
                <Play className="w-4 h-4 mr-1" />
                Join
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenBoard && onOpenBoard(game)}
              >
                <Eye className="w-4 h-4 mr-1" />
                Open
              </Button>
              {isHost && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete && onDelete(game.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
