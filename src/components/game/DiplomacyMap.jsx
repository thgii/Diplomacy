import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  territories as territoryData,
  getValidMoves,
  getAdjacencies,
  canSupportMoveToTerritory,
  findAllConvoyRoutes,
  getBaseTerritory,
} from "./mapData";
import { motion } from "framer-motion";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

// Helper function to check if a target territory is occupied by another unit
const isValidUnitPlacement = (currentUnits, targetTerritoryId, movingUnitId) => {
  const unitInTarget = currentUnits.find(
    (u) => u.territory === targetTerritoryId && u.id !== movingUnitId
  );
  return !unitInTarget;
};

// --- START: usePanAndZoom hook ---
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const INITIAL_ZOOM = 1;

const getTouchDistance = (touch1, touch2) => {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

const getTouchCenter = (touch1, touch2) => {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
};

const usePanAndZoom = (mapRef) => {
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const initialPinchDistanceRef = useRef(0);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.3, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev / 1.3, MIN_ZOOM));
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(INITIAL_ZOOM);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.target.tagName !== "svg" && e.target.tagName !== "DIV") return;
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isPanningRef.current) return;
    e.preventDefault();
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    panStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      if (isPanningRef.current) return;

      const zoomFactor = 1.1;
      const newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      if (Math.abs(clampedZoom - zoom) < 0.001) return;

      if (mapRef.current) {
        const mapRect = mapRef.current.getBoundingClientRect();
        const mouseX = e.clientX - mapRect.left;
        const mouseY = e.clientY - mapRect.top;

        const newPanX = mouseX - (mouseX - panOffset.x) * (clampedZoom / zoom);
        const newPanY = mouseY - (mouseY - panOffset.y) * (clampedZoom / zoom);

        setZoom(clampedZoom);
        setPanOffset({ x: newPanX, y: newPanY });
      }
    },
    [zoom, panOffset, mapRef]
  );

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isPanningRef.current = false;
      initialPinchDistanceRef.current = getTouchDistance(e.touches[0], e.touches[1]);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
      e.preventDefault();

      if (e.touches.length === 2 && initialPinchDistanceRef.current > 0) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const currentPinchDistance = getTouchDistance(t0, t1);
        const newZoom = zoom * (currentPinchDistance / initialPinchDistanceRef.current);
        const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

        if (Math.abs(clampedZoom - zoom) > 0.001) {
          if (mapRef.current) {
            const mapRect = mapRef.current.getBoundingClientRect();
            const pinchCenter = getTouchCenter(t0, t1);
            const centerX = pinchCenter.x - mapRect.left;
            const centerY = pinchCenter.y - mapRect.top;

            const newPanX = centerX - (centerX - panOffset.x) * (clampedZoom / zoom);
            const newPanY = centerY - (centerY - panOffset.y) * (clampedZoom / zoom);

            setZoom(clampedZoom);
            setPanOffset({ x: newPanX, y: newPanY });

            initialPinchDistanceRef.current = currentPinchDistance;
          }
        }
      } else if (e.touches.length === 1 && isPanningRef.current) {
        const touch = e.touches[0];
        const dx = touch.clientX - panStartRef.current.x;
        const dy = touch.clientY - panStartRef.current.y;
        setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        panStartRef.current = { x: touch.clientX, y: touch.clientY };
      }
    },
    [zoom, panOffset, mapRef]
  );

  const handleTouchEnd = useCallback(() => {
    isPanningRef.current = false;
    initialPinchDistanceRef.current = 0;
  }, []);

  useEffect(() => {
    const mapElement = mapRef.current;
    if (!mapElement) return;

    mapElement.addEventListener("mousedown", handleMouseDown);
    mapElement.addEventListener("mousemove", handleMouseMove);
    mapElement.addEventListener("mouseup", handleMouseUp);
    mapElement.addEventListener("mouseleave", handleMouseUp);
    mapElement.addEventListener("wheel", handleWheel, { passive: false });

    mapElement.addEventListener("touchstart", handleTouchStart, { passive: false });
    mapElement.addEventListener("touchmove", handleTouchMove, { passive: false });
    mapElement.addEventListener("touchend", handleTouchEnd);
    mapElement.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      mapElement.removeEventListener("mousedown", handleMouseDown);
      mapElement.removeEventListener("mousemove", handleMouseMove);
      mapElement.removeEventListener("mouseup", handleMouseUp);
      mapElement.removeEventListener("mouseleave", handleMouseUp);
      mapElement.removeEventListener("wheel", handleWheel);

      mapElement.removeEventListener("touchstart", handleTouchStart);
      mapElement.removeEventListener("touchmove", handleTouchMove);
      mapElement.removeEventListener("touchend", handleTouchEnd);
      mapElement.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [mapRef, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { panOffset, zoom, handleZoomIn, handleZoomOut, handleResetView };
};
// --- END: usePanAndZoom hook ---

// === Unit icon sizing & helpers ===
const ARMY_SIZE = 5;   // half-width of the square
const FLEET_SIZE = 6;  // triangle half-height from center to tip

// Upright, centered triangle (tip up). Points are relative to (0,0).
const trianglePoints = (s) => `0,${-s} ${s},${s} ${-s},${s}`;


export default function DiplomacyMap({
  game,
  user,
  units = [],
  orders = {},
  onSetOrder,
  showLastTurnResults = false,
  lastTurnResults = null,
  onBackgroundClick,
}) {
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [supportState, setSupportState] = useState({
    step: null,
    supportingUnit: null,
    supportedUnit: null,
    convoyedArmy: null,
  });
  const [highlightedTerritories, setHighlightedTerritories] = useState([]);
  const [selectedRetreatingUnit, setSelectedRetreatingUnit] = useState(null);

  const [unitMenu, setUnitMenu] = useState(null); // { unit, x, y }
  const [convoyFlow, setConvoyFlow] = useState(null); // { step, fleet, army, destinations }

  const mapRef = useRef(null);
  const menuRef = useRef(null);

  const { panOffset, zoom, handleZoomIn, handleZoomOut, handleResetView } = usePanAndZoom(mapRef);

  // --- Menu positioning (reverted: menu may go off-screen) ---
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!unitMenu || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const pxX = (rect.width * unitMenu.x) / 100;
    const pxY = (rect.height * unitMenu.y) / 100;

    const anchorX = rect.left + panOffset.x + pxX * zoom;
    const anchorY = rect.top + panOffset.y + pxY * zoom;

    const estW = menuRef.current?.offsetWidth ?? 176; // ~ w-44
    const estH = menuRef.current?.offsetHeight ?? 200;
    const gap = 10;

    // No clamping: can appear off-screen
    const left = Math.round(anchorX - estW / 2);
    const top = Math.round(anchorY - estH - gap);

    setMenuPos({ left, top });
  }, [unitMenu, panOffset, zoom, mapRef]);

  useEffect(() => {
    const onResize = () => {
      if (unitMenu) setMenuPos((p) => ({ ...p }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [unitMenu]);

  useEffect(() => {
    if (!unitMenu) return;
    requestAnimationFrame(() => setMenuPos((p) => ({ ...p })));
  }, [unitMenu]);

  const userPlayer = game.players?.find((p) => p.email === user.email);
  const isRetreatPhase = game.current_phase === "retreat";

  const retreatsRequired = useMemo(() => {
    return game.game_state?.retreats_required || [];
  }, [game.game_state?.retreats_required]);

  const getPlayerColor = (countryName) => {
    const player = game.players?.find((p) => p.country === countryName);
    return player?.color || "#a1a1aa";
  };

  const hexToRgba = (hex, alpha) => {
    let r = 0,
      g = 0,
      b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.substring(1, 3), 16);
      g = parseInt(hex.substring(3, 5), 16);
      b = parseInt(hex.substring(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const resetSelection = () => {
    setSelectedUnit(null);
    setSupportState({ step: null, supportingUnit: null, supportedUnit: null, convoyedArmy: null });
    setHighlightedTerritories([]);
    setSelectedRetreatingUnit(null);
    setUnitMenu(null);
    setConvoyFlow(null);
  };

  const findConvoyRoute = (fromTerritory, toTerritory, unitsList) => {
    const userFleetsInSea = unitsList.filter(
      (u) =>
        u.country === userPlayer.country &&
        u.type === "navy" &&
        territoryData[u.territory]?.type === "sea"
    );
    const convoyingFleetTerritories = new Set(userFleetsInSea.map((f) => f.territory));
    const baseDestination = toTerritory.includes("/")
      ? toTerritory.split("/")[0]
      : toTerritory;

    const queue = [];
    const visited = new Set();

    const initialNavalAdjacencies = getAdjacencies(fromTerritory)
      .filter((adj) => adj.naval)
      .map((adj) => adj.to);

    for (const seaTerritory of initialNavalAdjacencies) {
      if (territoryData[seaTerritory]?.type === "fleet_coast") {
        const seaZonesFromCoast = getAdjacencies(seaTerritory)
          .filter((adj) => adj.naval)
          .map((adj) => adj.to)
          .filter((terrId) => territoryData[terrId]?.type === "sea");

        for (const seaZone of seaZonesFromCoast) {
          if (convoyingFleetTerritories.has(seaZone) && !visited.has(seaZone)) {
            queue.push({ currentTerritory: seaZone, fleetPath: [seaZone] });
            visited.add(seaZone);
          }
        }
      } else if (convoyingFleetTerritories.has(seaTerritory)) {
        if (!visited.has(seaTerritory)) {
          queue.push({ currentTerritory: seaTerritory, fleetPath: [seaTerritory] });
          visited.add(seaTerritory);
        }
      }
    }

    while (queue.length > 0) {
      const { currentTerritory, fleetPath } = queue.shift();
      const navalAdjacenciesFromFleet = getAdjacencies(currentTerritory)
        .filter((adj) => adj.naval)
        .map((adj) => adj.to);

      const canReachDestination =
        navalAdjacenciesFromFleet.includes(baseDestination) ||
        navalAdjacenciesFromFleet.some((adj) => adj.startsWith(baseDestination + "/"));

      if (canReachDestination) return fleetPath;

      for (const nextSeaTerritory of navalAdjacenciesFromFleet) {
        if (convoyingFleetTerritories.has(nextSeaTerritory) && !visited.has(nextSeaTerritory)) {
          visited.add(nextSeaTerritory);
          queue.push({
            currentTerritory: nextSeaTerritory,
            fleetPath: [...fleetPath, nextSeaTerritory],
          });
        }
      }
    }
    return [];
  };

  const getPossibleConvoyDestinations = (armyTerritory, unitsList) => {
    const coastalTerritories = Object.entries(territoryData)
      .filter(([id, terr]) => (terr.type === "coast" || terr.type === "fleet_coast") && id !== armyTerritory)
      .map(([id]) => id);

    const validDestinations = new Set();
    coastalTerritories.forEach((terrId) => {
      const routes = findAllConvoyRoutes(armyTerritory, terrId, unitsList, userPlayer.country);
      if (routes.length > 0) {
        validDestinations.add(getBaseTerritory(terrId));
      }
    });
    return Array.from(validDestinations);
  };

  // Use ALL fleets on the board (any country) to see where an army could be convoyed.
  const getAllConvoyDestinations = (armyTerritory, unitsList) => {
    const coastalTerritories = Object.entries(territoryData)
      .filter(([id, terr]) => (terr.type === "coast" || terr.type === "fleet_coast") && id !== armyTerritory)
      .map(([id]) => id);

    const out = new Set();
    coastalTerritories.forEach((destId) => {
      const routes = findAllConvoyRoutes(armyTerritory, destId, unitsList, null);
      if (routes.length > 0) out.add(getBaseTerritory(destId));
    });
    return [...out];
  };

  const handleTerritoryClick = (e, terrId) => {
    e.stopPropagation();
    if (!userPlayer) return;

    // --- Convoy flow step 2: pick the DESTINATION ---
    if (convoyFlow?.step === "pick_destination") {
      const destBaseTap = terrId ? getBaseTerritory(terrId) : null;
      if (terrId && highlightedTerritories.includes(destBaseTap)) {
        const fleet = convoyFlow.fleet;
        const army = convoyFlow.army;

        onSetOrder(fleet.id, {
          unit_id: fleet.id,
          unit_type: "navy",
          territory: fleet.territory,
          action: "convoy",
          target: army.territory,
          convoy_destination: destBaseTap,
        });

        setConvoyFlow(null);
        resetSelection();
        return;
      }
      // tap elsewhere cancels
      setConvoyFlow(null);
      resetSelection();
      return;
    }

    // Finalizing a RETREAT order
    if (selectedRetreatingUnit) {
      if (highlightedTerritories.includes(terrId)) {
        onSetOrder(selectedRetreatingUnit.unit.id, {
          unit_id: selectedRetreatingUnit.unit.id,
          unit_type: selectedRetreatingUnit.unit.type,
          territory: selectedRetreatingUnit.fromTerritory,
          action: "retreat",
          target: terrId,
        });
      }
      resetSelection();
      return;
    }

    // Finalizing a SUPPORT order (Step 3: selecting destination for move or hold)
    if (supportState.step === "select_support_action") {
      const { supportingUnit, supportedUnit } = supportState;
      if (highlightedTerritories.includes(terrId)) {
        onSetOrder(supportingUnit.id, {
          unit_id: supportingUnit.id,
          unit_type: supportingUnit.type,
          territory: supportingUnit.territory,
          action: "support",
          target: terrId,
          target_of_support: supportedUnit.territory,
        });
      }
      resetSelection();
      return;
    }

    // Giving a MOVE order
    if (selectedUnit) {
      const validMoves = getValidMoves(selectedUnit.type, selectedUnit.territory);

      if (validMoves.includes(terrId)) {
        onSetOrder(selectedUnit.id, {
          unit_id: selectedUnit.id,
          unit_type: selectedUnit.type,
          territory: selectedUnit.territory,
          action: "move",
          target: terrId,
        });
        resetSelection();
        return;
      } else if (selectedUnit.type === "army" && terrId) {
        const anyRoutes = findAllConvoyRoutes(selectedUnit.territory, terrId, units, null);
        if (anyRoutes.length > 0) {
          onSetOrder(selectedUnit.id, {
            unit_id: selectedUnit.id,
            unit_type: "army",
            territory: selectedUnit.territory,
            action: "move",
            target: getBaseTerritory(terrId),
            via_convoy: true,
          });
          resetSelection();
          return;
        }
      }

      resetSelection();
      return;
    }

    resetSelection();
  };

  const handleUnitClick = (e, unit, isRetreatingUnitData = null) => {
    e.stopPropagation();

    // --- Convoy flow step 1: pick the ARMY to convoy ---
    if (convoyFlow?.step === "pick_army") {
      if (unit.type === "army" && highlightedTerritories.includes(unit.territory)) {
        const destinations = getConvoyDestinationsViaFleet(
          unit.territory,
          convoyFlow.fleet.territory,
          units
        );
        setHighlightedTerritories(destinations); // base ids
        setConvoyFlow({ step: "pick_destination", fleet: convoyFlow.fleet, army: unit, destinations });
        return;
      }
      // tap elsewhere cancels
      setConvoyFlow(null);
      resetSelection();
      return;
    }

     // Mobile-first fleet menu: only when no selection flow is active
  if (
    !isRetreatPhase &&
    unit.country === userPlayer.country &&
    unit.type === "navy" &&
    !selectedUnit &&                 // do not interrupt support target picking
    !supportState.step &&            // do not interrupt "select_support_action"
    !(convoyFlow && convoyFlow.step) // do not interrupt convoy flow
  ) {
    const terr = territoryData[unit.territory];
    setUnitMenu({ unit, x: terr.x, y: terr.y });
    return;
  }

    if (!userPlayer) return;

    // Handle retreat unit selection
    if (isRetreatingUnitData && isRetreatingUnitData.unit.country === userPlayer.country) {
      resetSelection();
      setSelectedRetreatingUnit(isRetreatingUnitData);
      setHighlightedTerritories(isRetreatingUnitData.validRetreats);
      return;
    }

    if (isRetreatPhase && !isRetreatingUnitData) {
      resetSelection();
      return;
    }

    // Finalizing a SUPPORT order by clicking on a unit in the target territory
    if (supportState.step === "select_support_action") {
      const { supportingUnit, supportedUnit } = supportState;

      if (highlightedTerritories.includes(unit.territory)) {
        onSetOrder(supportingUnit.id, {
          unit_id: supportingUnit.id,
          unit_type: supportingUnit.type,
          territory: supportingUnit.territory,
          action: "support",
          target: unit.territory,
          target_of_support: supportedUnit.territory,
        });

        resetSelection();
        return;
      }

      if (unit.id === supportedUnit.id) {
        if (highlightedTerritories.includes(supportedUnit.territory)) {
          onSetOrder(supportingUnit.id, {
            unit_id: supportingUnit.id,
            unit_type: supportingUnit.type,
            territory: supportingUnit.territory,
            action: "support",
            target: supportedUnit.territory,
            target_of_support: supportedUnit.territory,
          });

          resetSelection();
          return;
        }
      }

      resetSelection();
      return;
    }

    // Step 2: A unit is already selected, and we click another unit.
    if (selectedUnit) {
      if (selectedUnit.id === unit.id) {
        onSetOrder(selectedUnit.id, {
          unit_id: selectedUnit.id,
          unit_type: selectedUnit.type,
          territory: selectedUnit.territory,
          action: "hold",
        });
        resetSelection();
        return;
      }

      setSupportState({
        step: "select_support_action",
        supportingUnit: selectedUnit,
        supportedUnit: unit,
      });

      const supportingUnitValidMoves = getValidMoves(selectedUnit.type, selectedUnit.territory);
      let supportedUnitValidMoves = getValidMoves(unit.type, unit.territory);
      if (unit.type === "army") {
        const convoyDests = getAllConvoyDestinations(unit.territory, units);
        supportedUnitValidMoves = [...supportedUnitValidMoves, ...convoyDests];
      }

      const validSupportMoveDestinations = supportedUnitValidMoves.filter((dest) =>
        canSupportMoveToTerritory(supportingUnitValidMoves, dest)
      );

      const canSupportHold = supportingUnitValidMoves.includes(unit.territory);

      const territoriesToHighlight = [...validSupportMoveDestinations];
      if (canSupportHold) territoriesToHighlight.push(unit.territory);

      setHighlightedTerritories([...new Set(territoriesToHighlight)]);
      setSelectedUnit(null);
      return;
    }

    // Step 1: Nothing is selected, and we click one of our own units.
    if (unit.country === userPlayer.country) {
      setSelectedUnit(unit);
      let validMoves = getValidMoves(unit.type, unit.territory);

      if (unit.type === "army") {
        const convoyDestinations = getAllConvoyDestinations(unit.territory, units);
        validMoves = [...validMoves, ...convoyDestinations];
      }

      setHighlightedTerritories([...new Set(validMoves)]);
    } else {
      resetSelection();
    }
  };

  const territoryList = Object.entries(territoryData).filter(([id]) => id !== "Switzerland");

  const isRetreating = (unitId) => retreatsRequired.some((r) => r.unit.id === unitId);

  const dislodgedUnitIds = isRetreatPhase
    ? new Set(retreatsRequired.map((r) => r.unit.id))
    : new Set();

  const getRetreatDataForUnit = useCallback(
    (unitId) => {
      return retreatsRequired.find((r) => r.unit.id === unitId);
    },
    [retreatsRequired]
  );

  const allCoastIds = useMemo(
    () =>
      Object.entries(territoryData)
        .filter(([_, t]) => t.type === "coast" || t.type === "fleet_coast")
        .map(([id]) => id),
    []
  );

  const getConvoyDestinationsViaFleet = (armyFrom, fleetSea, allUnits) => {
    const out = new Set();
    for (const destId of allCoastIds) {
      const routes = findAllConvoyRoutes(armyFrom, destId, allUnits, null);
      if (routes.some((r) => r.includes(fleetSea))) {
        out.add(getBaseTerritory(destId));
      }
    }
    return [...out];
  };

  const armyIsConvoyableViaFleet = (army, fleetSea, allUnits) =>
    getConvoyDestinationsViaFleet(army.territory, fleetSea, allUnits).length > 0;

  return (
    <div className="h-full w-full bg-slate-100 p-2 md:p-4 relative">
      {/* Year Display */}
      {game?.year && (
        <div className="absolute top-4 left-4 z-10 bg-white p-2 rounded-md shadow-md text-lg font-bold text-gray-800">
          Year: {game.year}
        </div>
      )}

      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomIn}
          className="bg-white shadow-md hover:bg-slate-50 w-8 h-8 md:w-10 md:h-10"
        >
          <ZoomIn className="w-3 h-3 md:w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomOut}
          className="bg-white shadow-md hover:bg-slate-50 w-8 h-8 md:w-10 md:h-10"
        >
          <ZoomOut className="w-3 h-3 md:w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleResetView}
          className="bg-white shadow-md hover:bg-slate-50 w-8 h-8 md:w-10 md:h-10"
        >
          <RotateCcw className="w-3 h-3 md:w-4 h-4" />
        </Button>
      </div>

      <Card className="h-full shadow-xl overflow-hidden">
        <div
          ref={mapRef}
          className="relative w-full h-full overflow-hidden rounded-lg cursor-grab active:cursor-grabbing touch-none"
          style={{
            touchAction: "none",
            aspectRatio: "4/3",
            maxHeight: "100%",
            maxWidth: "100%",
          }}
          onClick={(e) => {
            handleTerritoryClick(e, null);
            if (onBackgroundClick) onBackgroundClick();
          }}
        >
          {/* Background Map Image */}
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/d18e3cf3d_l5bhjco4kiod1.jpg"
            alt="Diplomacy Map"
            className="absolute inset-0 w-full h-full object-fill pointer-events-none"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          />

          <div
            className="absolute inset-0 w-full h-full transition-transform duration-100 ease-out will-change-transform z-10"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              position: "absolute",
            }}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <marker id="move-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
                  <polygon points="0 0, 10 5, 0 10" fill="#22c55e" />
                </marker>
                <marker id="support-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
                  <polygon points="0 0, 10 5, 0 10" fill="#fbbf24" />
                </marker>
                <marker id="retreat-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
                  <polygon points="0 0, 10 5, 0 10" fill="#22c55e" />
                </marker>
                <marker id="convoy-arrowhead" markerWidth="3.2" markerHeight="3.2" refX="3" refY="1.25" orient="auto">
                  <polygon points="0 0, 4 1.25, 0 2.5" fill="#8b5cf6" />
                </marker>

                <filter id="glow" x="-50%" y="-50%" width="200%">
                  <feGaussianBlur stdDeviation="1" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="SourceGraphic" />
                    <feMergeNode in="coloredBlur" />
                  </feMerge>
                </filter>

                <pattern id="hold-pattern" patternUnits="userSpaceOnUse" width="4" height="4">
                  <rect width="4" height="4" fill="#3b82f6" opacity="0.1" />
                  <circle cx="2" cy="2" r="0.5" fill="#3b82f6" opacity="0.6" />
                </pattern>
              </defs>

              {/* Layer 1: Territory Interaction Areas */}
              {territoryList.map(([id, terr]) => {
                const isHighlighted = highlightedTerritories.includes(id);
                const isSelectedRetreatTarget = selectedRetreatingUnit && isHighlighted;
                const supplyCenterOwner = game.game_state?.supply_centers?.[id];
                const isSupplyCenter = terr.supply_center;

                let fillColor = "transparent";
                if (isSupplyCenter && supplyCenterOwner) {
                  const ownerColor = getPlayerColor(supplyCenterOwner);
                  if (ownerColor) {
                    fillColor = hexToRgba(ownerColor, 0.4);
                  }
                }

                return (
                  <g key={id}>
                    <circle
                      cx={`${terr.x}%`}
                      cy={`${terr.y}%`}
                      r="3"
                      fill={fillColor}
                      stroke={
                        isHighlighted ? "#16a34a" : selectedUnit?.territory === id ? "#fbbf24" : "transparent"
                      }
                      strokeWidth={
                        isHighlighted || isSelectedRetreatTarget ? 0.5 : selectedUnit?.territory === id ? 0.5 : 0
                      }
                      strokeDasharray={isSelectedRetreatTarget ? "1 1" : "none"}
                      className="transition-all duration-200 cursor-pointer"
                      onClick={(e) => handleTerritoryClick(e, id)}
                    />
                  </g>
                );
              })}

              {/* Layer 2: Order Arrows and Hold Indicators */}
              {showLastTurnResults && lastTurnResults ? (
                <>
                  {lastTurnResults.orders?.map((order) => {
                    const from = territoryData[order.territory];
                    const to = order.target ? territoryData[order.target] : null;

                    if (!from) return null;

                    // Handle Retreat Orders
                    if (order.action === "retreat" && to) {
                      const pathData = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
                      return (
                        <motion.g key={`result-retreat-${order.unit_id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <path
                            d={pathData}
                            stroke="#22c55e"
                            strokeWidth="0.8"
                            fill="none"
                            strokeDasharray="1.5 0.75"
                            markerEnd="url(#retreat-arrowhead)"
                            filter="drop-shadow(1px 1px 2px rgba(0,0,0,0.5))"
                            opacity="0.8"
                          />
                        </motion.g>
                      );
                    }

                    // For hold orders:
                    if (order.action === "hold") {
                      return (
                        <motion.g key={`result-hold-${order.unit_id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <circle
                            cx={`${from.x}%`}
                            cy={`${from.y}%`}
                            r="2"
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="0.8"
                            strokeDasharray="2 1"
                            opacity="0.8"
                            filter="drop-shadow(1px 1px 2px rgba(0,0,0,0.3))"
                          />
                          <circle cx={`${from.x}%`} cy={`${from.y}%`} r="1" fill="#3b82f6" opacity="0.6" />
                        </motion.g>
                      );
                    }

                    // For move, support, convoy orders (requires a 'to' territory)
                    if (!to) return null;

                    const isSuccessful = lastTurnResults.successful_moves?.some((m) => m.unit_id === order.unit_id);
                    const isFailed = lastTurnResults.failed_moves?.some((m) => m.unit_id === order.unit_id);

                    const isSupport = order.action === "support";
                    const isConvoy = order.action === "convoy";

                    let color = "#6b7280";
                    if (isSuccessful) color = "#22c55e";
                    if (isFailed) color = "#ef4444";

                    if (isSupport) {
                      color = isFailed ? "#dc2626" : "#f59e0b";
                    } else if (isConvoy) {
                      color = isFailed ? "#dc2626" : "#8b5cf6";
                    } else if (order.action === "move") {
                      if (!isSuccessful && !isFailed) {
                        color = "#f87171";
                      }
                    }

                    const markerEnd = isSupport
                      ? "url(#support-arrowhead)"
                      : isConvoy
                      ? "url(#convoy-arrowhead)"
                      : "url(#move-arrowhead)";

                    // Support hold orders
                    if (isSupport && order.target === order.target_of_support) {
                      return (
                        <motion.g key={`result-support-hold-${order.unit_id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <line
                            x1={`${from.x}%`}
                            y1={`${from.y}%`}
                            x2={`${to.x}%`}
                            y2={`${to.y}%`}
                            stroke={color}
                            strokeWidth="0.8"
                            strokeDasharray="3 2"
                            opacity="0.8"
                            filter="drop-shadow(1px 1px 2px rgba(0,0,0,0.5))"
                          />
                          <circle cx={`${to.x}%`} cy={`${to.y}%`} r="1.5" fill={color} opacity="0.6" />
                        </motion.g>
                      );
                    }

                    // Support move orders, curved path through supported unit
                    if (isSupport && order.target_of_support) {
                      const supportedUnit = territoryData[order.target_of_support];
                      if (supportedUnit) {
                        const pathData = `M ${from.x} ${from.y} Q ${supportedUnit.x} ${supportedUnit.y} ${to.x} ${to.y}`;

                        return (
                          <motion.g key={`result-${order.unit_id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <path
                              d={pathData}
                              stroke={color}
                              strokeWidth="0.8"
                              fill="none"
                              strokeDasharray="1.5 0.75"
                              markerEnd={markerEnd}
                              filter="drop-shadow(1px 1px 2px rgba(0,0,0,0.5))"
                              opacity="0.8"
                            />
                            <circle
                              cx={`${from.x}%`}
                              cy={`${from.y}%`}
                              r="1.5"
                              fill="none"
                              stroke="#fbbf24"
                              strokeWidth="0.3"
                              opacity="0.8"
                            />
                            <circle cx={`${supportedUnit.x}%`} cy={`${supportedUnit.y}%`} r="1.5" fill={color} opacity="0.6" />
                          </motion.g>
                        );
                      }
                    }

                    return (
                      <motion.g key={`result-${order.unit_id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <line
                          x1={`${from.x}%`}
                          y1={`${from.y}%`}
                          x2={`${to.x}%`}
                          y2={`${to.y}%`}
                          stroke={color}
                          strokeWidth="0.8"
                          strokeDasharray={isSupport ? "1.5 0.75" : isConvoy ? "2 1" : "none"}
                          markerEnd={markerEnd}
                          filter="drop-shadow(1px 1px 2px rgba(0,0,0,0.5))"
                          opacity="0.8"
                        />
                      </motion.g>
                    );
                  })}
                </>
              ) : (
                // Show current orders
                <>
                  {(Array.isArray(orders) ? orders : Object.values(orders || {})).map((order) => {
                    const from = territoryData[order.territory];
                    const to = order.target ? territoryData[order.target] : null;

                    if (!from) return null;

                    // Handle Retreat Orders
                    if (order.action === "retreat" && to) {
                      const pathData = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
                      return (
                        <motion.g key={`${order.unit_id}-retreat`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <path
                            d={pathData}
                            stroke="#22c55e"
                            strokeWidth="0.8"
                            fill="none"
                            strokeDasharray="1.5 0.75"
                            markerEnd="url(#retreat-arrowhead)"
                            filter="drop-shadow(1px 1px 2px rgba(0,0,0,0.5))"
                          />
                        </motion.g>
                      );
                    }

                    // For hold orders:
                    if (order.action === "hold") {
                      return (
                        <motion.g key={`hold-${order.unit_id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <circle
                            cx={`${from.x}%`}
                            cy={`${from.y}%`}
                            r="2"
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="0.8"
                            strokeDasharray="2 1"
                            opacity="0.8"
                            filter="drop-shadow(1px 1px 2px rgba(0,0,0,0.3))"
                          />
                          <circle cx={`${from.x}%`} cy={`${from.y}%`} r="1" fill="#3b82f6" opacity="0.6" />
                        </motion.g>
                      );
                    }

                    if (!to) return null;

                    const isSupport = order.action === "support";
                    const isConvoy = order.action === "convoy";

                    let color;
                    if (isSupport) {
                      color = "#fbbf24";
                    } else if (isConvoy) {
                      color = "#8b5cf6";
                    } else if (order.action === "move") {
                      color = "#22c55e";
                    } else {
                      color = "#22c55e";
                    }

                    const markerEnd = isSupport
                      ? "url(#support-arrowhead)"
                      : isConvoy
                      ? "url(#convoy-arrowhead)"
                      : "url(#move-arrowhead)";

                    // Support hold orders (target === target_of_support)
                    if (isSupport && order.target === order.target_of_support) {
                      return (
                        <motion.g key={`support-hold-${order.unit_id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <line
                            x1={`${from.x}%`}
                            y1={`${from.y}%`}
                            x2={`${to.x}%`}
                            y2={`${to.y}%`}
                            stroke="#3b82f6"
                            strokeWidth="0.8"
                            strokeDasharray="3 2"
                            filter="drop-shadow(1px 1px 2px rgba(0,0,0,0.5))"
                          />
                          <circle cx={`${to.x}%`} cy={`${to.y}%`} r="1.5" fill="#3b82f6" opacity="0.6" />
                        </motion.g>
                      );
                    }

                    // Support move orders, curved path through supported unit
                    if (isSupport && order.target_of_support) {
                      const supportedUnit = territoryData[order.target_of_support];
                      if (supportedUnit) {
                        const pathData = `M ${from.x} ${from.y} Q ${supportedUnit.x} ${supportedUnit.y} ${to.x} ${to.y}`;

                        return (
                          <motion.g key={order.unit_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <path
                              d={pathData}
                              stroke={color}
                              strokeWidth="0.8"
                              fill="none"
                              strokeDasharray="1.5 0.75"
                              markerEnd={markerEnd}
                              filter="drop-shadow(1px 1px 2px rgba(0,0,0,0.5))"
                            />
                            <circle
                              cx={`${from.x}%`}
                              cy={`${from.y}%`}
                              r="1.5"
                              fill="none"
                              stroke="#fbbf24"
                              strokeWidth="0.3"
                              opacity="0.8"
                            />
                            <circle cx={`${supportedUnit.x}%`} cy={`${supportedUnit.y}%`} r="1.5" fill={color} opacity="0.6" />
                          </motion.g>
                        );
                      }
                    }

                    return (
                      <motion.g key={order.unit_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <line
                          x1={`${from.x}%`}
                          y1={`${from.y}%`}
                          x2={`${to.x}%`}
                          y2={`${to.y}%`}
                          stroke={color}
                          strokeWidth="0.8"
                          strokeDasharray={isSupport ? "1.5 0.75" : isConvoy ? "2 1" : "none"}
                          markerEnd={markerEnd}
                          filter="drop-shadow(1px 1px 2px rgba(0,0,0,0.5))"
                        />
                      </motion.g>
                    );
                  })}
                </>
              )}

              {/* Layer 3: Units */}
              {Array.isArray(units) &&
                units.map((unit) => {
  const terr = territoryData[unit.territory];
  if (!terr) return null;

  const color = getPlayerColor(unit.country);
  const isSelected = selectedUnit?.id === unit.id;
  const isSupportTarget = supportState.supportedUnit?.id === unit.id;

  const isConvoyCandidate =
    convoyFlow?.step === "pick_army" &&
    unit.type === "army" &&
    highlightedTerritories.includes(unit.territory);

  const isConvoyChosenArmy =
    convoyFlow?.step === "pick_destination" &&
    convoyFlow?.army?.id === unit.id;

  const isDislodged = isRetreatPhase && dislodgedUnitIds.has(unit.id);
  const currentRetreatData = isDislodged ? getRetreatDataForUnit(unit.id) : null;

  let offsetX = 0;
  let offsetY = 0;
  if (isDislodged) {
    offsetX = 0.8;
    offsetY = -0.8;
  }

  const unitX = terr.x;
  const unitY = terr.y;

  // Robust type checks (so "navy"/"fleet"/"ship" all count as fleet)
  const unitType = (unit.type || "").toString().toLowerCase();
  const isArmy  = unitType === "army" || unitType === "infantry";
  const isFleet = unitType === "navy" || unitType === "fleet" || unitType === "ship";

  // Sizes tuned to your existing circle r=1.2
  const CIRCLE_R   = 1.2;   // circle radius (user units)
  const SQUARE_HW  = 0.8;   // half-width of square (in % since you used % for rect)
  const TRI_TIP    = 1.2;   // vertical offset from center to triangle tip (user units)
  const TRI_BASE   = 0.7;   // vertical offset from center to base corners (user units)
  const TRI_HALF_W = 1.0;   // half-width of triangle base (user units)

  return (
    <g
      key={unit.id}
      className="cursor-pointer"
      onClick={(e) => handleUnitClick(e, unit, currentRetreatData)}
    >
      {/* Dislodged blinking ring (kept unchanged) */}
      {isDislodged && (
        <circle
          cx={`${unitX + offsetX}%`}
          cy={`${unitY + offsetY}%`}
          r="2.5"
          fill="none"
          stroke="#ef4444"
          strokeWidth="0.3"
          opacity="0.8"
        >
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
          <animate attributeName="stroke-width" values="0.3;0.5;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Circle background (kept; drives your selection/support/convoy border colors) */}
      <circle
        cx={`${unitX + offsetX}%`}
        cy={`${unitY + offsetY}%`}
        r={CIRCLE_R}
        fill={isFleet ? color : "white"}
        stroke={
          isSelected
            ? "#fbbf24"
            : isSupportTarget
            ? "#e11d48"
            : isConvoyCandidate || isConvoyChosenArmy
            ? "#8b5cf6"
            : isFleet
            ? "#333"
            : color
        }
        strokeWidth={isSupportTarget ? 0.4 : (isSelected || isConvoyCandidate || isConvoyChosenArmy) ? 0.2 : 0.15}
        filter="drop-shadow(1px 1px 2px rgba(0,0,0,0.6))"
      />

      {/* Army glyph: centered square on top of the circle (unchanged approach) */}
      {isArmy && (
        <rect
          x={`${unitX + offsetX - SQUARE_HW}%`}
          y={`${unitY + offsetY - SQUARE_HW}%`}
          width={`${SQUARE_HW * 2}%`}
          height={`${SQUARE_HW * 2}%`}
          rx="0.25"
          fill={color}
          stroke="white"
          strokeWidth="0.05"
          className="pointer-events-none"
          filter="drop-shadow(1px 1px 1px rgba(0,0,0,0.4))"
        />
      )}

      {/* Fleet glyph: centered triangle ON TOP of the circle.
          IMPORTANT: no % in points, and no translate(%) — use absolute user units. */}
      {isFleet && (
        <polygon
          points={`
            ${unitX + offsetX},${unitY + offsetY - TRI_TIP}
            ${unitX + offsetX + TRI_HALF_W},${unitY + offsetY + TRI_BASE}
            ${unitX + offsetX - TRI_HALF_W},${unitY + offsetY + TRI_BASE}
          `}
          fill="white"
          stroke="rgba(0,0,0,0.75)"
          strokeWidth="0.05"
          className="pointer-events-none"
          filter="drop-shadow(1px 1px 1px rgba(0,0,0,0.4))"
        />
      )}

      {/* Keep all your existing additional cues below, unchanged */}
    </g>
  );
})
}

              {/* Layer 4: Territory Labels */}
              {territoryList.map(([id, terr]) => (
                <text
                  key={`label-${id}`}
                  x={`${terr.x}%`}
                  y={`${terr.y}%`}
                  dy=".5"
                  textAnchor="middle"
                  className="text-[0px] font-bold fill-slate-800 pointer-events-none opacity-60"
                  paintOrder="stroke"
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth="1"
                  strokeLinecap="butt"
                  strokeLinejoin="miter"
                >
                  {id}
                </text>
              ))}
            </svg>

{/* Fleet Action Menu — may appear off-screen by design */}
{unitMenu && (
  <div
    // anchored to the unit’s % coordinates; allowed to go off-screen
    style={{
      position: "absolute",
      left: `${unitMenu.x}%`,
      top: `${unitMenu.y}%`,
      transform: "translate(-50%, -110%)",
      zIndex: 50
    }}
    className="bg-white border border-slate-300 rounded-lg shadow-2xl p-2 w-44"
    onClick={(e) => e.stopPropagation()}
  >
    <div className="text-xs font-semibold text-slate-700 mb-2 text-center">
      Fleet in {unitMenu.unit.territory}
    </div>
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSelectedUnit(unitMenu.unit);
          setSupportState({ step: null, supportingUnit: null, supportedUnit: null, convoyedArmy: null });
          setHighlightedTerritories(getValidMoves("navy", unitMenu.unit.territory));
          setUnitMenu(null);
        }}
      >
        Move
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSelectedUnit(unitMenu.unit);
          setSupportState({ step: null, supportingUnit: null, supportedUnit: null, convoyedArmy: null });
          setHighlightedTerritories([]);
          setUnitMenu(null);
        }}
      >
        Support
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const fleet = unitMenu.unit;
          const convoyableArmyTerrs = units
            .filter((u) => u.type === "army" && armyIsConvoyableViaFleet(u, fleet.territory, units))
            .map((u) => u.territory);
          setHighlightedTerritories([...new Set(convoyableArmyTerrs)]);
          setConvoyFlow({ step: "pick_army", fleet, army: null, destinations: null });
          setUnitMenu(null);
        }}
      >
        Convoy
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onSetOrder(unitMenu.unit.id, {
            unit_id: unitMenu.unit.id,
            unit_type: "navy",
            territory: unitMenu.unit.territory,
            action: "hold",
          });
          setUnitMenu(null);
          resetSelection();
        }}
      >
        Hold
      </Button>

      <Button variant="ghost" size="sm" onClick={() => setUnitMenu(null)}>
        Cancel
      </Button>
    </div>
  </div>
)}
          </div> {/* end: absolute transform container */}
        </div>   {/* end: ref={mapRef} container */}
      </Card>
    </div>
  );
}

