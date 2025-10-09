
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, ShieldCheck, Skull, CheckCircle, XCircle, List } from "lucide-react";
import { OrderList, RetreatOrderList } from "./OrderList";
import { homeSupplyCenters, territories } from "./mapData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";


// Human-friendly line for any order
const describeOrder = (o) => {
  const t = (o.unit_type || '').toLowerCase();
  const unit = t === 'army' ? 'A' : (t === 'navy' || t === 'fleet') ? 'F' : (o.unit_type || '').toUpperCase();  switch (o.action) {
    case 'hold':
      return `${unit} ${o.territory} HOLD`;
    case 'move':
      return `${unit} ${o.territory} → ${o.target}`;
    case 'support':
      return `${unit} ${o.territory} SUPPORT ${o.target_of_support} → ${o.target}`;
    case 'convoy':
      return `${unit} ${o.territory} CONVOY ${o.target} → ${o.convoy_destination}`;
    case 'disband':
      return `${unit} ${o.territory} DISBAND`;
    case 'build':
      return `BUILD ${unit} ${o.territory}`;
    default:
      return `${(o.action || 'ORDER').toUpperCase()} ${unit} ${o.territory || ''}`.trim();
  }
};

// Strip coast suffixes to base province id (e.g., "SPA/nc" -> "SPA")
const canonProv = (t) => (typeof t === 'string' && t.includes('/') ? t.split('/')[0] : t || '');

// Full key includes unit id (good when we have it)
const moveKeyFull = (o) => `${String(o.unit_id ?? '')}|${canonProv(o.territory)}|${canonProv(o.target)}`;

// From→To key ignores unit id (useful for supports/convoys + fallbacks)
const moveKeyFromTo = (o) => `${canonProv(o.territory)}|${canonProv(o.target)}`;

const WinterOrderList = ({ game, user, units: allUnits, winterActions, onSetWinterActions, adjustments, playerUnits }) => {
    const userPlayer = game.players.find(p => p.email === user.email);

    if (!userPlayer) return null;

    const myUnits = playerUnits;
    const diff = adjustments;
    const units = allUnits;

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
        game.game_state.supply_centers[terrId] === userPlayer.country
    );
    const unoccupiedOwnedHomeSCs = ownedHomeSCs.filter(terrId =>
        !units.some(u => u.territory === terrId) && territories[terrId]
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
            const newActions = [...winterActions];
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
                    const currentAction = winterActions[i];
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
                                        const isTerritoryTaken = winterActions.some((action, actionIndex) =>
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
            const isAlreadySelected = winterActions.some(a => a.unit_id === unitId);
            if (isAlreadySelected) {
                onSetWinterActions(winterActions.filter(a => a.unit_id !== unitId));
            } else if (winterActions.length < numToDisband) {
                onSetWinterActions([...winterActions, { action: 'disband', unit_id: unitId }]);
            }
        };

        return (
            <div className="space-y-3">
                 <div className="text-center p-3 bg-red-50 text-red-700 rounded-lg">
                    <h4 className="font-semibold flex items-center justify-center gap-2"><Minus className="w-5 h-5"/>Disband {numToDisband} Unit(s)</h4>
                    {winterActions.length < numToDisband && (
                        <p className="text-sm">Select {numToDisband - winterActions.length} more.</p>
                    )}
                     {winterActions.length >= numToDisband && (
                        <p className="text-sm text-green-700">All disbands selected.</p>
                    )}
                </div>
                <div className="space-y-1">
                    {myUnits.map(unit => {
                        const isSelected = winterActions.some(a => a.unit_id === unit.id);
                        const terrName = territories[unit.territory]?.name || unit.territory;
                        return (
                            <Button
                                key={unit.id}
                                variant={isSelected ? "destructive" : "outline"}
                                className="w-full justify-start"
                                onClick={() => handleDisbandToggle(unit.id)}
                                disabled={!isSelected && winterActions.length >= numToDisband}
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



export default function GameControls({
  game,
  user,
  orders,
  units,
  onDeleteOrder,
  onSaveOrders,
  onSubmitOrders,
  onUnsubmitOrders,
  onVoteDraw,
  isSubmitted,
  isResolving,
  winterActions,
  onSetWinterActions,
  showLastTurnResults,
  onToggleLastTurnResults,
  lastTurnResults,
  onSetRetreatOrder
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const userPlayer = game?.players?.find(p => p.email === user?.email);
// ---- PHASE-AWARE FLAGS (add right after userPlayer) ----
const phase = game?.current_phase;

// Phase names in your app can be 'movement', 'retreat', 'retreats', 'winter', 'builds'.
// Normalize to a small set so our checks are robust:
const normPhase =
  phase === 'retreats' ? 'retreat' :
  phase === 'builds'   ? 'winter'  :
  phase;

// Who am I?
const playerCountry = userPlayer?.country;

// My units (used for winter adj math)
const playerUnits = (units || []).filter(u => u.country === playerCountry);

// NEW: remaining (by units) = has at least one unit
const isSurvivor = playerUnits.length > 0;

// SCs and adjustments
const supplyCenterCount = userPlayer?.supply_centers ?? 0;
const adjustments = supplyCenterCount - playerUnits.length; // >0 build, <0 disband, 0 none

// My required retreats (if any)
const retreatsRequired = game?.game_state?.retreats_required || [];
const myRetreats = retreatsRequired.filter(r => r.unit.country === playerCountry);

// Decide if action buttons should show this phase
const needsWinterAction  = normPhase === 'winter'  && adjustments !== 0;
const needsRetreatAction = normPhase === 'retreat' && myRetreats.length > 0;

// In movement phases (spring/fall), buttons should show as usual.
// In winter/retreat, show only if there’s something to do.
const hasUnits = playerUnits.length > 0;

const shouldShowActionButtons =
  normPhase === 'winter'  ? needsWinterAction  :
  normPhase === 'retreat' ? needsRetreatAction :
  hasUnits; // movement: only show if player still has a unit



  const handleSaveDraft = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      await onSaveOrders(false); // isFinalSubmission = false
      setSaveMessage('Draft Saved!');
    } catch (error) {
      // The error is already alerted in GameBoard, but we can set a message here too.
      setSaveMessage('Save Failed!');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(''), 3000); // Clear message after 3 seconds
    }
  };

  const renderOrderList = () => {
    if (!userPlayer) {
      return (
        <div className="text-center p-4 bg-slate-100 rounded-lg">
          <p className="text-sm text-slate-600">You are not a player in this game.</p>
        </div>
      );
    }

if (normPhase === 'winter') {
  const playerCountry = userPlayer.country;
  const playerUnits = (units || []).filter(u => u.country === playerCountry);
  const supplyCenterCount = userPlayer?.supply_centers ?? 0;
  const adjustments = supplyCenterCount - playerUnits.length;

  if (adjustments === 0) {
    return (
      <div className="text-center p-4 bg-slate-50 rounded-lg border">
        <p className="text-sm text-slate-600">No adjustments required this Winter.</p>
      </div>
    );
  }

  return (
    <WinterOrderList
      game={game}
      user={user}
      adjustments={adjustments}
      winterActions={winterActions}
      onSetWinterActions={onSetWinterActions}
      playerUnits={playerUnits}
      units={units}
    />
  );
}


if (normPhase === 'retreat') {
  const retreatsRequired = game.game_state?.retreats_required || [];
  const myRetreats = retreatsRequired.filter(r => r.unit.country === userPlayer.country);

  if (myRetreats.length === 0) {
    return (
      <div className="text-center p-4 bg-slate-50 rounded-lg border">
        <p className="text-sm text-slate-600">You have no units that must retreat.</p>
      </div>
    );
  }

  return (
    <RetreatOrderList
      retreats={myRetreats}
      orders={orders}
      onSetRetreatOrder={onSetRetreatOrder}
    />
  );
}

// Movement phase: if you have no units, show a friendly note instead of buttons/list
if (normPhase !== 'winter' && normPhase !== 'retreat' && playerUnits.length === 0) {
  return (
    <div className="text-center p-4 bg-slate-50 rounded-lg border">
      <p className="text-sm text-slate-600">You have no units on the board. You are a loser.</p>
    </div>
  );
}


    return <OrderList orders={Object.values(orders || {})} onDeleteOrder={onDeleteOrder} />;
  };

  const userHasVotedDraw = game?.draw_votes?.includes(user?.email);
  const activePlayers = (game?.players || []).filter(p => !p.is_dummy && (units || []).some(u => u.country === p.country)) || [];

  return (
    <div className="bg-white border-t border-slate-200 p-4 space-y-4">
      {/* Turn Results Toggle */}
      {lastTurnResults && (
        <div className="flex items-center space-x-2 bg-slate-50 p-2 rounded-md">
          <Checkbox
            id="show-last-turn"
            checked={showLastTurnResults}
            onCheckedChange={onToggleLastTurnResults}
          />
          <Label htmlFor="show-last-turn" className="text-sm font-medium">
            Show Last Turn's Results
          </Label>
        </div>
      )}

      {/* Main Order/Action List */}
      <div className="max-h-60 overflow-y-auto pr-2">
        {showLastTurnResults && lastTurnResults ? (
          <div className="space-y-3">
            <h4 className="text-lg font-semibold flex items-center gap-2">
              <List className="w-5 h-5" /> 
              Last Turn Orders — {String(lastTurnResults.phase || '').toUpperCase()} {lastTurnResults.turn}
            </h4>

                         {(() => {
               // Build quick lookup sets for success/fail of moves
               const successMoveSetFull   = new Set((lastTurnResults.successful_moves || []).map(moveKeyFull));
               const successMoveSetFromTo = new Set((lastTurnResults.successful_moves || []).map(moveKeyFromTo));
               // Map origin province -> set of successful destination provinces
               const successByOrigin = new Map();
               (lastTurnResults.successful_moves || []).forEach(m => {
                 const from = canonProv(m.territory);
                 const to   = canonProv(m.target);
                 if (!successByOrigin.has(from)) successByOrigin.set(from, new Set());
                 successByOrigin.get(from).add(to);
               });

               const dislodgedIds   = new Set((lastTurnResults.dislodged_units || []).map(u => String(u.unit?.id ?? u.id)));

               // For supports/convoys, we’ll infer “success” by whether the referenced move succeeded.
              const isSupportSuccessful = (o) => {
  if (!o?.target_of_support) return false;

  const supBase = canonProv(o.target_of_support);
  const tgtBase = o.target ? canonProv(o.target) : null;

  // Treat (no target) OR (target equals the supported province) as support-to-hold
  const isHoldSupport = !o.target || supBase === tgtBase;
  if (isHoldSupport) {
    return !dislodgedByProv.has(supBase);
  }

  // Otherwise it's support-to-move
  const fake = { territory: o.target_of_support, target: o.target };
  return successMoveSetFromTo.has(moveKeyFromTo(fake));
};


                const isConvoySuccessful = (o) => {
                if (!o?.target) return false;
                const origin = canonProv(o.target);

                // If a destination was explicitly specified on the convoy order, check that move
                if (o.convoy_destination) {
                  const fake = { territory: origin, target: canonProv(o.convoy_destination) };
                  return successMoveSetFromTo.has(moveKeyFromTo(fake));
                }

                // No explicit destination: consider the convoy "successful" if
                // any move from the origin succeeded (i.e., an army was convoyed from there).
                return successByOrigin.has(origin) && successByOrigin.get(origin).size > 0;
              };


               const dislodgedByProv = new Set(
                 (lastTurnResults.dislodged_units || []).map(u => canonProv(u.territory))
               );

               // --- Grouping helpers ---
               const POWER_ORDER = ["England","France","Germany","Italy","Austria","Russia","Turkey","Unknown"];
               const short = (p) => ({England:"E",France:"F",Germany:"G",Italy:"I",Austria:"A",Russia:"R",Turkey:"T"}[p] || "?");
               const getOrderCountry = (o) => {
                 // Try common fields first, then resolve via units list
                 const direct = o.country || o.power || o.unit_country || o.owner;
                 if (direct) return direct;
                 const byUnit = (units || []).find(u => String(u.id) === String(o.unit_id));
                 return byUnit?.country || "Unknown";
               };
 
               // Prepare buckets
               const buckets = new Map(); // country -> JSX[]
 
              // Build each row and push into its power bucket
              (lastTurnResults.orders || []).forEach((o, idx) => {
                 let ok = false;
               
                 switch (o.action) {
                   case 'move':
                     ok = successMoveSetFull.has(moveKeyFull(o)) || successMoveSetFromTo.has(moveKeyFromTo(o));
                     break;
                   case 'hold':
                     // A hold “fails” if the unit was dislodged
                     ok = !dislodgedIds.has(String(o.unit_id ?? '')) && !(!o.unit_id && dislodgedByProv.has(canonProv(o.territory)));
                     break;
                   case 'support':
                     ok = isSupportSuccessful(o);
                     break;
                   case 'convoy':
                     ok = isConvoySuccessful(o);
                     break;
                   case 'disband':
                   case 'build':
                     // Treat as success for display
                     ok = true;
                     break;
                   default:
                     ok = false;
                 }
 
                 const Icon = ok ? CheckCircle : XCircle;
                 const colorText = ok ? "text-emerald-300" : "text-red-300";
                 const colorIcon = ok ? "text-emerald-400" : "text-red-400";
                 const badgeCls  = ok ? "border-emerald-500 text-emerald-300" : "border-red-500 text-red-300";
                const power = getOrderCountry(o);
                const key = o.id ?? `${o.unit_id}-${idx}`;
                const unitLetter = (o.unit_type || '').toLowerCase() === 'army' ? 'A' : 'F';

                // For convoy rows, if convoy_destination is missing, try to infer one from successByOrigin
                let prettyText = describeOrder(o);
                if (o.action === 'convoy' && !o.convoy_destination) {
                  const origin = canonProv(o.target);
                  const inferred = successByOrigin.has(origin) ? [...successByOrigin.get(origin)][0] : '—';
                  prettyText = `${unitLetter} ${o.territory} CONVOY ${o.target} → ${inferred}`;
                }

                const row = (
                  <div
                    key={key}
                    className="flex items-start justify-between rounded-lg border border-slate-200 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${colorIcon}`} />
                      
                      <span className={`font-medium ${colorText}`}>{prettyText}</span>
                    </div>
                    <Badge variant="outline" className={badgeCls}>
                      {ok ? "SUCCESS" : "FAILED"}
                    </Badge>
                  </div>
                );
                if (!buckets.has(power)) buckets.set(power, []);
                buckets.get(power).push(row);

              });
 
              // Render buckets in canonical power order, then any extras
              const orderedPowers = [
                ...POWER_ORDER.filter(p => buckets.has(p)),
                ...[...buckets.keys()].filter(p => !POWER_ORDER.includes(p))
              ];

              if (orderedPowers.length === 0) {
  return (
    <div className="text-sm text-slate-500">
      No orders recorded for this round.
    </div>
  );
}


              return orderedPowers.map((power) => (
                <div key={power} className="space-y-2">
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border">
                      {short(power)}
                    </span>
                    <h5 className="text-sm font-semibold text-slate-800">{power}</h5>
                  </div>
                  {buckets.get(power)}
                </div>
              ));
             })()}



          </div>

        ) : renderOrderList()}
      </div>

      {/* Always show controls section, even if not a player */}
      {userPlayer ? (
        <>
          {/* Draw Feature */}
          {game?.status === 'in_progress' && (
  isSurvivor ? (
    <div className="flex items-center space-x-2 pt-2 border-t">
      <Checkbox
        id="vote-draw"
        checked={userHasVotedDraw}
        onCheckedChange={(checked) => onVoteDraw(checked)}
        disabled={isSubmitted || isResolving}
      />
      <Label htmlFor="vote-draw" className="text-sm font-medium">
        Vote for Draw ({game.draw_votes?.length || 0}/{activePlayers.length})
      </Label>
    </div>
  ) : (
    <div className="text-xs text-slate-500 pt-2 border-t">
      Eliminated players don’t vote in draws.
    </div>
  )
)}


{/* Action Buttons */}
{shouldShowActionButtons && (
  <div className="flex flex-col gap-2 mt-4">
    {!isSubmitted ? (
      <>
        <Button
          onClick={handleSaveDraft}
          disabled={isResolving || isSaving}
          variant="secondary"
        >
          Save Orders
        </Button>

        <Button
          onClick={() => onSubmitOrders(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={isResolving || isSaving}
        >
          Finalize Orders
        </Button>
      </>
    ) : (
      <Button
        onClick={onUnsubmitOrders}
        variant="outline"
        disabled={isResolving}
      >
        Unsubmit Orders
      </Button>
    )}
  </div>
)}
        </>
      ) : (
        <div className="text-center p-4 bg-slate-100 rounded-lg">
          <p className="text-sm text-slate-600">Spectator Mode - You are not playing in this game.</p>
        </div>
      )}
    </div>
  );
}
