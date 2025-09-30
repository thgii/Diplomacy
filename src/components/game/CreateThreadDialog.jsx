import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users } from "lucide-react";

export default function CreateThreadDialog({ open, onClose, players, currentUserEmail, onCreateThread }) {
  const [selectedPlayers, setSelectedPlayers] = useState([]);

  const handlePlayerToggle = (email) => {
    setSelectedPlayers((prev) =>
      prev.includes(email)
        ? prev.filter((pEmail) => pEmail !== email)
        : [...prev, email]
    );
  };

  const handleSubmit = () => {
    if (selectedPlayers.length === 0) return;

    // Generate thread name based on participating countries
    const countryAbbrevs = {
      England: "E",
      France: "F",
      Germany: "G",
      Italy: "I",
      Austria: "A",
      Russia: "R",
      Turkey: "T",
    };

    const participantCountries = [
      ...selectedPlayers
        .map(email => players.find(p => p.email === email)?.country),
      players.find(p => p.email === currentUserEmail)?.country
    ].filter(Boolean).sort();

    const threadName = participantCountries
      .map(c => countryAbbrevs[c] ?? (c?.[0] ?? "?"))
      .join("-");


    onCreateThread({
      name: threadName,
      participants: [...selectedPlayers, currentUserEmail], // Include current user in participants
    });
    
    // Reset state and close
    onClose();
    setSelectedPlayers([]);
  };

  const otherPlayers = players.filter(p => p.email !== currentUserEmail);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Create Diplomatic Channel
          </DialogTitle>
          <DialogDescription>
            Select countries to start a private conversation. The channel name will be generated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="space-y-2">
              <ScrollArea className="h-48 rounded-md border p-2">
                <div className="space-y-2">
                  {otherPlayers.map((player) => (
                    <div
                      key={player.email}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                      onClick={() => handlePlayerToggle(player.email)}
                    >
                      <Checkbox
                        checked={selectedPlayers.includes(player.email)}
                        onCheckedChange={() => handlePlayerToggle(player.email)}
                      />
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: player.color }}
                        />
                        <span className="font-medium text-sm">{player.country}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedPlayers.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Create Channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}