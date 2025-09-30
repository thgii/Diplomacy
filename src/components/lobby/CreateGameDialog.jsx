
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Crown, Users, Clock, Shuffle, Dice1 } from "lucide-react";

const COUNTRIES = [
  "Austria-Hungary",
  "England", 
  "France",
  "Germany",
  "Italy",
  "Russia",
  "Turkey"
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

const WAR_NAMES = [
  "The Great European Conflict",
  "War of Continental Supremacy",
  "The Balance of Power War",
  "The Diplomatic Crisis",
  "The Imperial Struggle", 
  "War of Seven Nations",
  "The Continental War",
  "The European Theater",
  "The Grand Alliance War",
  "The Strategic Equilibrium",
  "War of Crowns",
  "The Monarchical Conflict",
  "The Treaty War",
  "War of Empires",
  "The Diplomatic Revolution",
  "The Continental Conflagration",
  "The War of Dynasties",
  "The League of Thrones",
  "The Struggle for Supremacy",
  "The Coalition Wars",
  "The Grand Continental Crisis",
  "The Rivalry of Empires",
  "The War of the Alliance",
  "The Concert of Nations",
  "The Great Continental Struggle",
  "The Imperial Rivalry",
  "The Succession Crisis",
  "The Continental Catastrophe",
  "The War of Monarchs",
  "The Age of Wars",
  "The Diplomatic Balance War",
  "The Struggle of Sovereigns",
  "The Clash of Thrones",
  "The Continental Conquest",
  "The War of Treaties",
  "The Continental Entanglement",
  "The Balance of Thrones",
  "The War of Realms",
  "The Grand Coalition Struggle",
  "The War of Partition",
  "The Continental Rivalry",
  "The Age of Alliances",
  "The War of Confederacies",
  "The Diplomatic Maelstrom",
  "The European Contest",
  "The Thrones and Crowns War",
  "The Imperial Balance Struggle",
  "The Sovereigns’ Clash",
  "The Age of Coalitions",
  "The Continental Upheaval",
  "The Balance of Empires",
  "The War of Succession",
  "The Continental Fracture",
  "The Crowned Heads’ War",
  "The War of the Courts",
  "The European Discord",
  "The Continental Dilemma",
  "The Great State Struggle",
  "The Pact Wars",
  "The Clash of Monarchs",
  "The Grand Diplomatic War",
  "The Alliance Entanglement",
  "The Concert War",
  "The Struggle for Hegemony",
  "The Continental Storm"
];

const TURN_LENGTH_OPTIONS = [
  { value: 1, label: "1 hour ( Very Fast)" },
  { value: 12, label: "12 hours (Fast)" },
  { value: 24, label: "24 hours (Standard)" },
  { value: 48, label: "48 hours (Relaxed)" },
  { value: 72, label: "72 hours (Casual)" },
  { value: 168, label: "1 week (Long-term)" }
];

export default function CreateGameDialog({ open, onClose, onCreate }) {
  const [formData, setFormData] = useState({
    name: "",
    selectedCountry: "",
    max_players: 7, // Diplomacy is a 7-player game, this is now fixed.
    turn_length_hours: 24,
    auto_adjudicate: true,
    random_assignment: true // Changed default to true
  });

  useEffect(() => {
    if (open && !formData.name) {
      const randomName = WAR_NAMES[Math.floor(Math.random() * WAR_NAMES.length)];
      setFormData(prev => ({ ...prev, name: randomName }));
    }
  }, [open, formData.name]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && (formData.random_assignment || formData.selectedCountry)) {
      onCreate(formData);
      setFormData({ 
        name: "", 
        selectedCountry: "", 
        max_players: 7, // Reset to 7
        turn_length_hours: 24, 
        auto_adjudicate: true, 
        random_assignment: true // Reset to true default
      });
    }
  };

  const generateRandomName = () => {
    const randomName = WAR_NAMES[Math.floor(Math.random() * WAR_NAMES.length)];
    setFormData({...formData, name: randomName});
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="w-5 h-5 text-blue-600" />
            Create New Diplomatic Crisis
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="gameName" className="text-sm font-medium">
              War Name
            </Label>
            <div className="flex gap-2">
              <Input
                id="gameName"
                placeholder="Enter a diplomatic title..."
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="h-11 flex-1"
                required
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={generateRandomName}
                className="h-11"
              >
                <Dice1 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="randomAssignment"
                checked={formData.random_assignment}
                onCheckedChange={(checked) => setFormData({...formData, random_assignment: checked, selectedCountry: checked ? "" : formData.selectedCountry})}
              />
              <Label htmlFor="randomAssignment" className="text-sm font-medium flex items-center gap-2">
                <Shuffle className="w-4 h-4" />
                Random Nation Assignment (Recommended)
              </Label>
            </div>
            
            {!formData.random_assignment && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Choose Your Nation</Label>
                <Select 
                  value={formData.selectedCountry} 
                  onValueChange={(value) => setFormData({...formData, selectedCountry: value})}
                  required={!formData.random_assignment}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select your nation..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
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
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Turn Length
            </Label>
            <Select 
              value={formData.turn_length_hours.toString()} 
              onValueChange={(value) => setFormData({...formData, turn_length_hours: parseInt(value)})}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TURN_LENGTH_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="autoAdjudicate"
              checked={formData.auto_adjudicate}
              onCheckedChange={(checked) => setFormData({...formData, auto_adjudicate: checked})}
            />
            <Label htmlFor="autoAdjudicate" className="text-sm">
              Auto-adjudicate when turn expires (recommended)
            </Label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <Crown className="w-4 h-4 mr-2" />
              Begin Conflict
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

