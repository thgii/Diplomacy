// src/components/game/Adjudicator.js
// Core Diplomacy adjudication (Standard rules).
// Handles: holds, moves, support-to-hold/move, cutting support (with exception),
// head-to-head, cycles, convoy validation & disruption, beleaguered garrisons,
// self-dislodge prohibition, and legal retreats.
//
// Assumptions about unit shape (based on your app):
//   unit: { id, country, type: 'army' | 'navy', territory: 'PROV' | 'PROV/COAST', dislodged? }
//   order: {
//     unit_id, action: 'hold' | 'move' | 'support' | 'convoy',
//     territory?: unit's current territory (optional in payload),
//     target?: province (for move/support target province),
//     target_of_support?: province (origin of the supported unit),
//     convoy_destination?: province (optional explicit convoy dest),
//     via_convoy?: boolean (optional UI hint; not required)
//   }
//
// Integration helpers preserved:
// - territories, getAdjacencies, getBaseTerritory from ./mapData
// - asId(), base(), canon(), stripTempSuffix()
// - adjudicate(units, rawOrders) => { newUnits, dislodgedUnits: [{unit, fromTerritory, attackerTerritory, validRetreats: [prov/coast,...]}] }

import { territories, getAdjacencies, getBaseTerritory } from "./mapData";

// ---------- Helpers kept / refined ----------
const asId = (v) => String(v);
const base = (t) => (typeof t === "string" && t.includes("/") ? t.split("/")[0] : t);

// Canonicalize any territory id to the map's base province id.
const canon = (t) => {
  if (t == null) return null;
  if (typeof t !== "string") return t;
  const b = t.includes("/") ? t.split("/")[0] : t;
  try {
    const g = getBaseTerritory ? getBaseTerritory(b) : b;
    return g || b;
  } catch {
    return b;
  }
};

// Remove client-side temporary suffixes like "-1758730630474"
const stripTempSuffix = (id) =>
  typeof id === "string" ? id.replace(/-\d{13,}$/, "") : id;

// Safe read of province meta
const terr = (t) => territories[canon(t)] || null;

// Is there a land edge from->to (province graph considers naval vs land)
function isLandAdjacent(from, to) {
  const f = canon(from);
  const t = canon(to);
  if (!f || !t) return false;
  const neighbors = getAdjacencies(f) || [];
  return neighbors.some((adj) => !adj.naval && canon(adj.to) === t);
}

// Sea-coast match helper for convoy BFS
function anyCoastMatches(toBase, neighbors) {
  return neighbors.some((adj) => {
    if (!adj.naval) return false;
    const b = canon(adj.to);
    return b === toBase || adj.to.startsWith(`${toBase}/`);
  });
}

// Deduplicate so only the last order per unit counts
function normalizeOrders(raw) {
  const byUnit = new Map();
  for (const o of Array.isArray(raw) ? raw : []) {
    if (!o) continue;
    const rawId = o.unit_id ?? o.unit?.id ?? null;
    if (!rawId) continue;
    const cleanId = stripTempSuffix(String(rawId));
    byUnit.set(cleanId, { ...o, unit_id: cleanId });
  }
  return [...byUnit.values()];
}

// ---------- Convoy path search ----------
// There exists a chain of fleets (not dislodged) each with matching CONVOY orders
// bridging the army's origin to the destination province (base), per standard rules.
function existsIntactConvoyPath(armyFrom, armyToBase, units, orders, dislodgedSeaBaseSet) {
  const from = canon(armyFrom);
  const dest = canon(armyToBase);

  // Map fleets by sea province that issued a matching convoy (origin matches, destination exact if provided)
  const convoyFleetBySea = new Map();
  for (const u of units) {
    if (!u || u.type !== "navy") continue;
    const seaBase = canon(u.territory);
    const conv = orders.find(
      (x) => x.action === "convoy" && asId(x.unit_id) === asId(u.id)
    );
    if (!conv) continue;
    if (canon(conv.target) !== from) continue;
    const d = conv.convoy_destination ? canon(conv.convoy_destination) : null;
    if (d && d !== dest) continue; // if specified, must match
    if (dislodgedSeaBaseSet.has(seaBase)) continue; // dislodged fleet cannot convoy
    if (terr(seaBase)?.type !== "sea") continue;
    convoyFleetBySea.set(seaBase, u);
  }
  if (convoyFleetBySea.size === 0) return false;

  // BFS across seas (naval edges only), seeded by seas adjacent to the army origin (including via fleet_coast hop)
  const startSeas = [];
  for (const adj of getAdjacencies(from) || []) {
    if (!adj.naval) continue;
    const s = canon(adj.to);
    if (convoyFleetBySea.has(s)) startSeas.push(s);

    // If origin neighbors a fleet_coast, allow hopping to adjoining seas
    const tmeta = terr(adj.to);
    if (tmeta?.type === "fleet_coast") {
      for (const a2 of getAdjacencies(canon(adj.to)) || []) {
        if (!a2.naval) continue;
        const s2 = canon(a2.to);
        if (convoyFleetBySea.has(s2)) startSeas.push(s2);
      }
    }
  }

  const q = [...new Set(startSeas)];
  const seen = new Set(q);
  while (q.length) {
    const sea = q.shift();
    const navNeighbors = (getAdjacencies(sea) || []).filter((a) => a.naval);
    if (anyCoastMatches(dest, navNeighbors)) return true;
    for (const n of navNeighbors) {
      const nb = canon(n.to);
      if (terr(nb)?.type !== "sea") continue;
      if (!convoyFleetBySea.has(nb) || seen.has(nb)) continue;
      seen.add(nb);
      q.push(nb);
    }
  }
  return false;
}

// ---------- Strength calculations ----------
function getAttackStrength(unit, targetTerritory, allOrders, allUnits, cutSupportsSet) {
  let s = 1;
  const unitFrom = canon(unit.territory);
  const tgt = canon(targetTerritory);

  for (const o of allOrders) {
    if (o.action !== "support") continue;
    if (cutSupportsSet.has(o.unit_id)) continue;
    // support to move: "target_of_support" is the mover's origin, "target" is the destination
    if (canon(o.target_of_support) === unitFrom && canon(o.target) === tgt) s += 1;
  }
  return s;
}

function getHoldStrength(unit, allOrders, cutSupportsSet) {
  let s = 1;
  for (const o of allOrders) {
    if (o.action !== "support") continue;
    if (cutSupportsSet.has(o.unit_id)) continue;
    // support to hold: both fields equal the province being held
    if (
      canon(o.target_of_support) === canon(unit.territory) &&
      canon(o.target) === canon(unit.territory)
    ) {
      s += 1;
    }
  }
  return s;
}

// ---------- Order legality checks ----------
function isLegalMove(unit, target) {
  const tMeta = terr(target);
  if (!tMeta) return false;

  // Keep exact coast for fleets; armies can be canonicalized to base province
  const from = unit.type === "navy" ? unit.territory : canon(unit.territory);
  const to = canon(target);


  // Armies: cannot move to pure sea or fleet-only coast without convoy
  if (unit.type === "army") {
    const direct = isLandAdjacent(from, to);
    if (direct) return true; // land move
    // else only legal if a convoy exists; we validate later with convoy path
    return true; // tentatively accept; convoy validation phase will cancel if needed
  }

  // Fleets: must use naval edges, cannot move to pure inland land
  if (unit.type === "navy") {
    const neighbors = (getAdjacencies(from) || []).filter((a) => a.naval);
    return neighbors.some((a) => canon(a.to) === to);
  }

  return false;
}

// ---------- Main adjudication ----------
export function adjudicate(units, rawOrders) {
  const orders = normalizeOrders(rawOrders);
  const liveUnits = Array.isArray(units) ? units.filter((u) => u && u.id) : [];
  const unitsById = new Map(liveUnits.map((u) => [asId(u.id), u]));
  const cleanOrders = orders.filter((o) => unitsById.has(asId(o.unit_id)));
  const ordersByUnit = new Map(cleanOrders.map((o) => [asId(o.unit_id), o]));

  // Default orders: any unit without an order is HOLDing
  for (const u of liveUnits) {
    if (!ordersByUnit.has(asId(u.id))) {
      ordersByUnit.set(asId(u.id), { unit_id: asId(u.id), action: "hold" });
    }
  }
  const allOrders = [...ordersByUnit.values()];

  // Partition by type
  const moveOrders = allOrders.filter((o) => o.action === "move");
  const supportOrders = allOrders.filter((o) => o.action === "support");
  const convoyOrders = allOrders.filter((o) => o.action === "convoy");

  // Phase A: Drop blatantly illegal move targets (bad adjacency for fleets etc.)
  const legalMove = new Set();
  for (const o of moveOrders) {
    const u = unitsById.get(asId(o.unit_id));
    if (u && o.target && isLegalMove(u, o.target)) legalMove.add(asId(u.id));
  }

  // Phase B: Determine CUT SUPPORTS (standard rule):
  // A support is cut if the supporting unit is attacked (by anyone) from any province,
  // EXCEPT from the province that is the target of the support-to-move order.
  // (Support-to-hold has no exception.)
  const cutSupports = new Set();

  // Build quick index: who attacks which province (raw intents)
  const attackersByTarget = new Map(); // base -> [{attackerUnit, fromBase}]
  for (const o of moveOrders) {
    const u = unitsById.get(asId(o.unit_id));
    if (!u) continue;
    const tgt = canon(o.target);
    if (!attackersByTarget.has(tgt)) attackersByTarget.set(tgt, []);
    attackersByTarget.get(tgt).push({ attacker: u, from: canon(u.territory) });
  }

  for (const s of supportOrders) {
    const supporter = unitsById.get(asId(s.unit_id));
    if (!supporter) continue;
    const supBase = canon(supporter.territory);
    const attackedBy = attackersByTarget.get(supBase) || [];

    // Exception: if support is for a MOVE into province X,
    // an attack from X does not cut (even if it fails). (Classic rule.)
    const exceptFrom = s.action === "support" && s.target ? canon(s.target) : null;

    for (const atk of attackedBy) {
      if (asId(atk.attacker.country) === asId(supporter.country)) continue; // same country doesn't cut
      if (exceptFrom && canon(atk.from) === exceptFrom && s.target_of_support) {
        // This is the exception only for support-to-move (has target_of_support)
        // Support-to-hold has no exception; but when target_of_support equals supporter.territory and target equals same, this branch won’t trigger.
        continue;
      }
      // Any attack at all cuts (no strength check for cut itself).
      cutSupports.add(asId(s.unit_id));
      break;
    }
  }

  // Phase C: Compute entrant strengths per destination and head-to-head info
  const entrantsByTarget = new Map(); // base -> [{ unit, fromBase, str }]
  for (const o of moveOrders) {
    const u = unitsById.get(asId(o.unit_id));
    if (!u || !legalMove.has(asId(u.id))) continue;
    const tgt = canon(o.target);
    const str = getAttackStrength(u, o.target, allOrders, liveUnits, cutSupports);
    if (!entrantsByTarget.has(tgt)) entrantsByTarget.set(tgt, []);
    entrantsByTarget.get(tgt).push({ unit: u, from: canon(u.territory), str });
  }

  // Build hold strengths for current occupants
  const holdStrengthByBase = new Map();
  const occupantByBase = new Map();
  for (const u of liveUnits) {
    const b = canon(u.territory);
    occupantByBase.set(b, u);
  }
  for (const [b, u] of occupantByBase.entries()) {
    const s = getHoldStrength(u, allOrders, cutSupports);
    holdStrengthByBase.set(b, s);
  }

  // Phase D: Head-to-head (swap attempts): if A->B and B->A, compare strengths.
  // Stronger succeeds; tie = both bounce. Self-dislodge prohibition applied later.
  const headToHeadPairs = new Set();
  const successfulMoves = new Set(); // unit_id
  const bouncedTargets = new Set(); // province bases with standoff

  function hasMove(fromBase, toBase) {
    const arr = entrantsByTarget.get(toBase) || [];
    return arr.some((e) => e.from === fromBase);
  }

  for (const [toBase, entrants] of entrantsByTarget.entries()) {
    for (const e of entrants) {
      const reciprocal = hasMove(toBase, e.from); // someone trying back into e.from
      if (!reciprocal) continue;
      headToHeadPairs.add(`${e.from}->${toBase}`);
    }
  }

  for (const key of headToHeadPairs) {
    const [aFrom, aTo] = key.split("->");
    const bFrom = aTo;
    const bTo = aFrom;

    const a = (entrantsByTarget.get(aTo) || []).find((e) => e.from === aFrom);
    const b = (entrantsByTarget.get(bTo) || []).find((e) => e.from === bFrom);
    if (!a || !b) continue;

    if (a.str > b.str) {
      successfulMoves.add(asId(a.unit.id));
      // The loser defends in place with its HOLD strength (handled in general pass)
    } else if (b.str > a.str) {
      successfulMoves.add(asId(b.unit.id));
    } else {
      // tie -> both bounce at their destinations
      bouncedTargets.add(aTo);
      bouncedTargets.add(bTo);
    }
  }

  // Phase E: Resolve simple attacks (non-head-to-head) vs present hold strengths.
  // Track provisional dislodgements (to revisit for convoy disruption & self-dislodge).
  let dislodged = []; // { unit, fromTerritory: base, attackerTerritory: base }
  for (const [tgt, entrants] of entrantsByTarget.entries()) {
    // If already bounced by H2H tie, skip — it’s a standoff at tgt
    if (bouncedTargets.has(tgt)) continue;

    // Determine the strongest entrant(s)
    let max = -Infinity;
    for (const e of entrants) max = Math.max(max, e.str);
    const top = entrants.filter((e) => e.str === max);

    if (top.length > 1) {
      // multi-way tie -> standoff at tgt
      bouncedTargets.add(tgt);
      continue;
    }

    const winner = top[0];
    // Compare vs defender's hold strength (if any)
    const defender = occupantByBase.get(tgt) || null;
    const defStr = holdStrengthByBase.get(tgt) || 0;

    if (winner.str > defStr) {
      successfulMoves.add(asId(winner.unit.id));
      if (defender) {
        // If defender is also moving, it *might* escape; we’ll handle vacate-fill later.
        dislodged.push({
          unit: defender,
          fromTerritory: tgt,
          attackerTerritory: canon(winner.from),
        });
      }
    } else {
      // beleaguered garrison / failed attack: bounce at tgt
      bouncedTargets.add(tgt);
    }
  }

  // Phase G: Convoy validation & disruption (invalidate non-adjacent army moves without an intact path).
  // First collect dislodged fleets (sea bases).
  const dislodgedSeaBases = new Set(
    dislodged
      .filter((d) => d.unit?.type === "navy" && terr(d.unit.territory)?.type === "sea")
      .map((d) => canon(d.unit.territory))
  );

  const invalidConvoyTargets = new Set(); // bases where a move was invalidated, to undo dislodges if caused by it

  for (const o of moveOrders) {
    const u = unitsById.get(asId(o.unit_id));
    if (!u || u.type !== "army") continue;
    if (!successfulMoves.has(asId(u.id))) continue; // only validate successes
    const toBase = canon(o.target);
    const needsConvoy = !isLandAdjacent(canon(u.territory), toBase);
    if (!needsConvoy) continue;

    const ok = existsIntactConvoyPath(u.territory, toBase, liveUnits, allOrders, dislodgedSeaBases);
    if (!ok) {
      successfulMoves.delete(asId(u.id));
      invalidConvoyTargets.add(toBase);
    }
  }

  if (invalidConvoyTargets.size) {
    dislodged = dislodged.filter((d) => !invalidConvoyTargets.has(canon(d.fromTerritory)));
  }

  // Phase H: Self-dislodge prohibition:
  // A country cannot dislodge its own unit. If an attack would dislodge a friendly unit,
  // it instead bounces — but ONLY if the friendly defender does not successfully leave.
  if (dislodged.length) {
    const keep = [];
    for (const d of dislodged) {
      // Find the attack that would take d.fromTerritory
      const atkOrder = moveOrders.find(
        (o) =>
          successfulMoves.has(asId(o.unit_id)) &&
          canon(o.target) === canon(d.fromTerritory)
      );
      const atkUnit = atkOrder ? unitsById.get(asId(atkOrder.unit_id)) : null;

      // Did the defender (the unit that would be dislodged) actually succeed in leaving?
      const defOrder = ordersByUnit.get(asId(d.unit.id));
      const defenderLeaves =
        defOrder &&
        defOrder.action === "move" &&
        successfulMoves.has(asId(d.unit.id));

      // If same country AND the defender did not leave, this would be a self-dislodge → convert to bounce
      if (atkUnit && atkUnit.country === d.unit.country && !defenderLeaves) {
        // undo the attacker’s success and mark a standoff at the defender’s province
        successfulMoves.delete(asId(atkUnit.id));
        bouncedTargets.add(canon(d.fromTerritory));
        continue; // drop this provisional dislodgement
      }

      // Otherwise keep the dislodgement (enemy attack OR friendly but the defender left)
      keep.push(d);
    }
    dislodged = keep;
  }

    // --- Phase H.1: Void supports from dislodged supporters and recompute battles once ---
  // Rules: a unit that is DISLODGED cannot give support. We already computed "cutSupports"
  // (attacks on supporters), but we must also ignore supports from supporters that got dislodged.
  // We run ONE recompute pass using a merged ignore-set for supports, then overwrite
  // successfulMoves / bouncedTargets / dislodged with the corrected values before vacate-fill.

  if (dislodged.length) {
    const dislodgedSupporterIds = new Set(
      dislodged
        .map((d) => asId(d.unit.id))
        .filter((uid) => {
          const o = ordersByUnit.get(uid);
          return o && o.action === "support";
        })
    );

    if (dislodgedSupporterIds.size) {
      // Merge: already-cut supports + supports from dislodged supporters
      const ignoreSupports = new Set([...cutSupports, ...dislodgedSupporterIds]);

      // Rebuild entrantsByTarget with updated strengths (ignoring those supports)
      const entrantsByTarget2 = new Map();
      for (const o of moveOrders) {
        const u = unitsById.get(asId(o.unit_id));
        if (!u || !legalMove.has(asId(u.id))) continue;
        const tgt = canon(o.target);
        const str = getAttackStrength(u, o.target, allOrders, liveUnits, ignoreSupports);
        if (!entrantsByTarget2.has(tgt)) entrantsByTarget2.set(tgt, []);
        entrantsByTarget2.get(tgt).push({ unit: u, from: canon(u.territory), str });
      }

      // Rebuild hold strengths with the same ignore set
      const holdStrengthByBase2 = new Map();
      for (const [b, u] of occupantByBase.entries()) {
        const s = getHoldStrength(u, allOrders, ignoreSupports);
        holdStrengthByBase2.set(b, s);
      }

      // Re-evaluate head-to-head & simple attacks ONCE with the corrected strengths
      const successfulMoves2 = new Set();
      const bouncedTargets2 = new Set();

      function hasMove2(fromBase, toBase) {
        const arr = entrantsByTarget2.get(toBase) || [];
        return arr.some((e) => e.from === fromBase);
      }

      // head-to-head
      const h2hPairs2 = new Set();
      for (const [toBase, entrants] of entrantsByTarget2.entries()) {
        for (const e of entrants) {
          const reciprocal = hasMove2(toBase, e.from);
          if (reciprocal) h2hPairs2.add(`${e.from}->${toBase}`);
        }
      }
      for (const key of h2hPairs2) {
        const [aFrom, aTo] = key.split("->");
        const bFrom = aTo, bTo = aFrom;
        const a = (entrantsByTarget2.get(aTo) || []).find((e) => e.from === aFrom);
        const b = (entrantsByTarget2.get(bTo) || []).find((e) => e.from === bFrom);
        if (!a || !b) continue;
        if (a.str > b.str) {
          successfulMoves2.add(asId(a.unit.id));
        } else if (b.str > a.str) {
          successfulMoves2.add(asId(b.unit.id));
        } else {
          bouncedTargets2.add(aTo);
          bouncedTargets2.add(bTo);
        }
      }

      // simple attacks
      let dislodged2 = [];
      for (const [tgt, entrants] of entrantsByTarget2.entries()) {
        if (bouncedTargets2.has(tgt)) continue;
        let max = -Infinity;
        for (const e of entrants) max = Math.max(max, e.str);
        const top = entrants.filter((e) => e.str === max);
        if (top.length > 1) {
          bouncedTargets2.add(tgt);
          continue;
        }
        const winner = top[0];
        const defender = occupantByBase.get(tgt) || null;
        const defStr = holdStrengthByBase2.get(tgt) || 0;
        if (winner.str > defStr) {
          successfulMoves2.add(asId(winner.unit.id));
          if (defender) {
            dislodged2.push({
              unit: defender,
              fromTerritory: tgt,
              attackerTerritory: canon(winner.from),
            });
          }
        } else {
          bouncedTargets2.add(tgt);
        }
      }

      // Replace with the corrected results before continuing
      successfulMoves.clear();
      for (const uid of successfulMoves2) successfulMoves.add(uid);
      bouncedTargets.clear();
      for (const b of bouncedTargets2) bouncedTargets.add(b);
      dislodged = dislodged2;
    }
  }



    // Phase F: Vacate-fill (multi-pass: handle long chains A→B→C→D→…)
    // Keep promoting entrants into origins vacated by successful movers until no change.
    while (true) {
      const before = successfulMoves.size;

      // Compute currently vacated origins from units that successfully moved
      const vacated = new Set();
      for (const uid of successfulMoves) {
        const u = unitsById.get(asId(uid));
        if (!u) continue;
        vacated.add(canon(u.territory));
      }

      // For each vacated origin, allow the strongest entrant to fill it (ties bounce)
      for (const originBase of vacated) {
        const entrants = entrantsByTarget.get(originBase) || [];
        if (entrants.length === 0) continue;

        let best = null;
        let tie = false;
        for (const e of entrants) {
          // entrants are already filtered to legal moves earlier
          if (!best || e.str > best.str) {
            best = e;
            tie = false;
          } else if (e.str === best.str) {
            tie = true;
          }
        }

        if (best && !tie) {
          successfulMoves.add(asId(best.unit.id));   // promote the filler
          bouncedTargets.delete(originBase);         // clear any stale standoff
        } else if (entrants.length > 0) {
          bouncedTargets.add(originBase);            // explicit tie → standoff
        }
      }

      if (successfulMoves.size === before) break;    // reached fixed point
    }



  // Phase I: Apply successful moves to produce new unit positions
  const newUnits = liveUnits.map((u) => ({ ...u, dislodged: false })); // reset dislodged flags
  const unitIndexById = new Map(newUnits.map((u, i) => [asId(u.id), i]));

  for (const uid of successfulMoves) {
    const idx = unitIndexById.get(uid);
    const order = ordersByUnit.get(uid);
    if (idx == null || !order || order.action !== "move") continue;
    // Preserve exact target (keep coast suffix if present in order)
    newUnits[idx].territory = order.target;
  }

  // Mark dislodged defenders
  for (const d of dislodged) {
    const idx = unitIndexById.get(asId(d.unit.id));
    if (idx != null) newUnits[idx].dislodged = true;
  }

  // Phase J: Compute legal retreats
  // Rules:
  //  - Cannot retreat to: the province the unit was dislodged from, the attacker’s origin,
  //    any province that had a standoff, or any province occupied after movement.
  //  - Armies cannot retreat to sea or fleet-only coasts; fleets cannot retreat inland.
  //  - Must use legal edge type (land vs naval).
  const occupiedAfter = new Set(
    newUnits.filter((u) => !u.dislodged).map((u) => canon(u.territory))
  );
  const standoffs = new Set(bouncedTargets);

  const dislodgedWithRetreats = dislodged.map((d) => {
    const invalid = new Set([
      canon(d.fromTerritory),
      canon(d.attackerTerritory),
      ...standoffs,
      ...occupiedAfter,
    ]);

    // Fleets retreat from their exact coast node; armies from base province
    const fromNode = d.unit.type === "navy" ? d.fromTerritory : canon(d.fromTerritory);
    const options = [];


    for (const adj of getAdjacencies(fromNode) || []) {
      const to = adj.to;
      const tMeta = terr(to);
      if (!tMeta) continue;

      if (d.unit.type === "army") {
        if (adj.naval) continue;
        if (tMeta.type === "sea" || tMeta.type === "fleet_coast") continue;
      } else if (d.unit.type === "navy") {
        // Fleets can retreat to sea and fleet coasts; not to pure inland land
        if (tMeta.type === "land") continue;
        // Must be reachable via naval edge
        if (!adj.naval) continue;
      }

      if (invalid.has(canon(to))) continue;
      options.push(to);
    }

    // Unique list (may include province/coast strings)
    const validRetreats = [...new Set(options)];
    return { unit: d.unit, fromTerritory: d.fromTerritory, attackerTerritory: d.attackerTerritory, validRetreats };
  });

  return { newUnits, dislodgedUnits: dislodgedWithRetreats };
}

export default { adjudicate };

