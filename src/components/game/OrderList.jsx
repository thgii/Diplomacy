
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Shield, Swords, Move, Anchor, Sailboat, RotateCcw, ShieldCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { territories } from "./mapData";


export function OrderList({ orders, onDeleteOrder }) {
  const orderArray = Object.values(orders);

  if (orderArray.length === 0) {
    return (
      <Card className="text-center bg-slate-50 border-dashed">
        <CardContent className="p-4">
          <p className="text-sm text-slate-500">No orders issued for this phase.</p>
        </CardContent>
      </Card>
    );
  }

  const getIcon = (action) => {
    switch (action) {
      case 'hold': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'move': return <Move className="w-4 h-4 text-green-500" />;
      case 'support': return <Swords className="w-4 h-4 text-yellow-500" />;
      case 'convoy': return <Sailboat className="w-4 h-4 text-purple-500" />;
      default: return <Anchor className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-2">
      {orderArray.map(order => (
        <div key={order.unit_id} className="flex items-center justify-between p-2 rounded-md bg-white border">
          <div className="flex items-center gap-2 text-sm">
            {getIcon(order.action)}
            <div className="font-mono text-xs">
              <span className="font-semibold">{order.unit_type === 'army' ? 'A' : 'F'} {order.territory}</span>
              {' -> '}
              {order.action === 'hold' && 'HOLD'}
              {order.action === 'move' && order.target}
              {order.action === 'support' && `SUPPORT ${order.target_of_support} -> ${order.target}`}
              {order.action === 'convoy' && `CONVOY ${order.target} -> ${order.convoy_destination}`}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => onDeleteOrder(order.unit_id)}>
            <Trash2 className="w-3 h-3 text-red-500" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function RetreatOrderList({ retreats, orders, onSetRetreatOrder }) {
  const getTerritoryName = (id) => territories[id]?.name || id;

  if (!retreats || retreats.length === 0) {
    return (
        <div className="text-center p-4 bg-slate-100 rounded-lg">
            <ShieldCheck className="w-8 h-8 mx-auto text-green-600 mb-2" />
            <h4 className="font-semibold">No Retreats Required</h4>
            <p className="text-sm text-slate-600">All your units are safe.</p>
        </div>
    );
  }

  return (
    <div className="space-y-4">
        <div className="text-center p-3 bg-yellow-50 text-yellow-700 rounded-lg">
            <h4 className="font-semibold flex items-center justify-center gap-2">
                <RotateCcw className="w-5 h-5"/>
                Retreat Units
            </h4>
            <p className="text-sm">Select a retreat destination for each dislodged unit, or choose to disband.</p>
        </div>
        {retreats.map(retreat => {
            const unit = retreat.unit;
            const currentOrder = orders[unit.id];
            const selectedValue = currentOrder?.action === 'disband' ? 'disband' : currentOrder?.target || 'none';

            return (
                <div key={unit.id} className="p-3 border rounded-md space-y-2">
                    <h5 className="font-medium text-sm">
                        {unit.type.charAt(0).toUpperCase() + unit.type.slice(1)} from {getTerritoryName(retreat.fromTerritory)}
                    </h5>
                    <Select
                        value={selectedValue}
                        onValueChange={(val) => {
                            const action = val === "disband" ? "disband" : "retreat";
                            const target = val === "disband" ? null : val;
                            onSetRetreatOrder(unit.id, {
                                unit_id: unit.id,
                                unit_type: unit.type,
                                territory: retreat.fromTerritory,
                                action: action,
                                target: target
                            });
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select Action..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none" disabled>-- Select Destination --</SelectItem>
                            <SelectItem value="disband">Disband Unit</SelectItem>
                            {retreat.validRetreats.map(rTerr => (
                                <SelectItem key={rTerr} value={rTerr}>
                                    Retreat to {getTerritoryName(rTerr)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            );
        })}
    </div>
  );
}
