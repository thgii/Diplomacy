import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, X } from "lucide-react";

export default function PlayerPanel({ game, user, onClose }) {
  const sortedPlayers = game.players?.sort((a, b) => 
    (b.supply_centers || 0) - (a.supply_centers || 0)
  );

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Great Powers</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8">
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-3">
          {sortedPlayers?.map((player, index) => (
            <div key={player.email} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {index === 0 && <Crown className="w-4 h-4 text-yellow-500" />}
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                </div>
                <div>
                  <div className="font-medium text-slate-900">
                    {player.country}
                  </div>
                  {player.email === user.email && (
                    <Badge variant="outline" className="text-xs mt-1">You</Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-900">
                  {player.supply_centers || 0}
                </div>
                <div className="text-xs text-slate-500">Centers</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}