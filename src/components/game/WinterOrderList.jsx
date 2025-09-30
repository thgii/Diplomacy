
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, ShieldCheck, Skull } from "lucide-react";
import { homeSupplyCenters, territories } from "./mapData";

const WinterOrderList = ({ game, user, units: allUnits, winterActions, onSetWinterActions, adjustments, playerUnits }) => {
    const userPlayer = game?.players?.find(p => p.email === user.email);
    if (!userPlayer) return null;

    const myUnits = playerUnits || [];
    const diff = adjustments;
    const units = allUnits || [];

    const isValidUnitPlacement = (currentUnits, territoryId) => {
      const baseTerritoryId =
        typeof territoryId === 'string' && territoryId.includes('/') ? territoryId.split('/')[0] : territoryId;
    const isOccupied = (currentUnits || []).some(u => {
      const uBase = (typeof u.territory === 'string' && u.territory.includes('/'))
        ? u.territory.split('/')[0]
        : u.territory;
      return uBase === baseTerritoryId;
    });
      return !isOccupied;
    };

    const ownedHomeSCs = (homeSupplyCenters[userPlayer.country] || []).filter(terrId =>
        game.game_state?.supply_centers?.[terrId] === userPlayer.country
    );
    const unoccupiedOwnedHomeSCs = ownedHomeSCs.filter(terrId =>
        !(units || []).some(u => u.territory === terrId) && territories[terrId]
    );

    if (diff === 0) {
        return (
            <div className="text-center p-4 bg-slate-100 rounded-lg">
                <ShieldCheck className="w-8 h-8 mx-auto text-green-600 mb-2" />
                <h4 className="font-semibold">Forces Balanced</h4>
                <p className="text-sm text-slate-600">No builds or disbands required.</p>
            </div>
        );
    }

    if (diff > 0) {
        const maxBuilds = Math.min(diff, 3);

        if (!homeSupplyCenters || !territories) {
            return <div className="text-center p-4 text-red-600">Error: Map data not loaded.</div>;
        }

        const handleBuildChange = (index, terrId, unitType) => {
            const newActions = [...(winterActions || [])];
            if (unitType === 'army' || unitType === 'navy') {
                const baseTerritoryIdForNewBuild = terrId.includes('/') ? terrId.split('/')[0] : terrId;

                const existingBuildForTerritory = newActions.some((action, idx) =>
                    action.action === 'build' &&
                    (action.territory === baseTerritoryIdForNewBuild ||
                     (action.territory.includes('/') && action.territory.split('/')[0] === baseTerritoryIdForNewBuild)) &&
                    idx !== index
                );
                if (existingBuildForTerritory) {
                    return;
                }

                if (unitType === 'navy') {
                    if (!isValidUnitPlacement(units, terrId)) {
                        alert(`Cannot build fleet there - territory is occupied.`);
                        return;
                    }
                }

                newActions[index] = {
                    action: 'build',
                    territory: terrId,
                    unit_type: unitType,
                    unit_id: userPlayer.country
                };
            } else {
                newActions[index] = { action: 'none' };
            }
            onSetWinterActions(newActions.filter(a => a.action !== 'none'));
        };

        return (
            <div className="space-y-3">
                <div className="text-center p-3 bg-blue-50 text-blue-700 rounded-lg">
                    <h4 className="font-semibold flex items-center justify-center gap-2">
                        <Plus className="w-5 h-5"/>
                        Build {maxBuilds} Unit(s) {diff > 3 && <span className="text-xs">(Max 3 per turn)</span>}
                    </h4>
                </div>
                {Array.from({ length: maxBuilds }).map((_, i) => {
                    const currentAction = (winterActions || [])[i];
                    const currentValue = currentAction && currentAction.action === 'build'
                                        ? `${currentAction.territory}:${currentAction.unit_type}`
                                        : 'none:none';

                    return (
                        <div key={i} className="space-y-2 p-2 border rounded-md">
                            <Select
                                value={currentValue}
                                onValueChange={val => {
                                    const [terrId, unitType] = val.split(':');
                                    handleBuildChange(i, terrId, unitType);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={`Build #${i + 1}`} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none:none">-- No Selection --</SelectItem>
                                    {unoccupiedOwnedHomeSCs.map(terrId => {
                                        const terr = territories[terrId];
                                        if (!terr) return null;
                                        const isCoastal = terr.type === 'coast';

                                        const baseTerritoryForCheck = terrId;
                                        const isTerritoryTaken = (winterActions || []).some((action, actionIndex) =>
                                            action.action === 'build' &&
                                            (action.territory === baseTerritoryForCheck ||
                                             (action.territory.includes('/') && action.territory.split('/')[0] === baseTerritoryForCheck)) &&
                                            actionIndex !== i
                                        );

                                        return (
                                            <React.Fragment key={terrId}>
                                                <SelectItem
                                                    value={`${terrId}:army`}
                                                    disabled={isTerritoryTaken}
                                                >
                                                    Army in {terr.name} {isTerritoryTaken && "(Taken)"}
                                                </SelectItem>
                                                {isCoastal &&
                                                    <SelectItem
                                                        value={`${terrId}:navy`}
                                                        disabled={isTerritoryTaken}
                                                    >
                                                        Navy in {terr.name} {isTerritoryTaken && "(Taken)"}
                                                    </SelectItem>}
                                                {terrId === 'STP' && (
                                                    <>
                                                        <SelectItem value={`STP/nc:navy`} disabled={isTerritoryTaken}>
                                                            Navy in St Petersburg (North Coast) {isTerritoryTaken && "(Taken)"}
                                                        </SelectItem>
                                                        <SelectItem value={`STP/sc:navy`} disabled={isTerritoryTaken}>
                                                            Navy in St Petersburg (South Coast) {isTerritoryTaken && "(Taken)"}
                                                        </SelectItem>
                                                    </>
                                                )}
                                                {terrId === 'SPA' && (
                                                    <>
                                                        <SelectItem value={`SPA/nc:navy`} disabled={isTerritoryTaken}>
                                                            Navy in Spain (North Coast) {isTerritoryTaken && "(Taken)"}
                                                        </SelectItem>
                                                        <SelectItem value={`SPA/sc:navy`} disabled={isTerritoryTaken}>
                                                            Navy in Spain (South Coast) {isTerritoryTaken && "(Taken)"}
                                                        </SelectItem>
                                                    </>
                                                )}
                                                {terrId === 'BUL' && (
                                                    <>
                                                        <SelectItem value={`BUL/ec:navy`} disabled={isTerritoryTaken}>
                                                            Navy in Bulgaria (East Coast) {isTerritoryTaken && "(Taken)"}
                                                        </SelectItem>
                                                        <SelectItem value={`BUL/sc:navy`} disabled={isTerritoryTaken}>
                                                            Navy in Bulgaria (South Coast) {isTerritoryTaken && "(Taken)"}
                                                        </SelectItem>
                                                    </>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    );
                })}
            </div>
        );
    }

    if (diff < 0) { // Disband phase
        const numToDisband = Math.abs(diff);

        const handleDisbandToggle = (unitId) => {
            const isAlreadySelected = (winterActions || []).some(a => a.unit_id === unitId);
            if (isAlreadySelected) {
                onSetWinterActions((winterActions || []).filter(a => a.unit_id !== unitId));
            } else if ((winterActions || []).length < numToDisband) {
                onSetWinterActions([...(winterActions || []), { action: 'disband', unit_id: unitId }]);
            }
        };

        return (
            <div className="space-y-3">
                 <div className="text-center p-3 bg-red-50 text-red-700 rounded-lg">
                    <h4 className="font-semibold flex items-center justify-center gap-2"><Minus className="w-5 h-5"/>Disband {numToDisband} Unit(s)</h4>
                    {(winterActions || []).length < numToDisband && (
                        <p className="text-sm">Select {numToDisband - (winterActions || []).length} more.</p>
                    )}
                     {(winterActions || []).length >= numToDisband && (
                        <p className="text-sm text-green-700">All disbands selected.</p>
                    )}
                </div>
                <div className="space-y-1">
                    {myUnits.map(unit => {
                        const isSelected = (winterActions || []).some(a => a.unit_id === unit.id);
                        const terrName = territories[unit.territory]?.name || unit.territory;
                        return (
                            <Button
                                key={unit.id}
                                variant={isSelected ? "destructive" : "outline"}
                                className="w-full justify-start"
                                onClick={() => handleDisbandToggle(unit.id)}
                                disabled={!isSelected && (winterActions || []).length >= numToDisband}
                            >
                                <Skull className="w-4 h-4 mr-2" />
                                {unit.type === 'army' ? 'Army' : 'Navy'} in {terrName}
                            </Button>
                        )
                    })}
                </div>
            </div>
        )
    }

    return null;
}

export default WinterOrderList;
