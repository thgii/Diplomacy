import React, { useState, useEffect, useRef } from 'react';
import { Timer } from 'lucide-react';

const PhaseTimer = ({ deadline, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const firedRef = useRef(false); // ensure onExpire is called only once per deadline

  useEffect(() => {
    // reset guard when deadline changes
    firedRef.current = false;

    if (!deadline) {
      setTimeLeft('');
      return;
    }

    const calculateTimeLeft = () => {
      const diff = new Date(deadline) - new Date();
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
        if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      } else {
        // expired
        if (!firedRef.current) {
          firedRef.current = true;
          if (typeof onExpire === 'function') onExpire();
        }
        return '00:00';
      }
    };

    // set immediately so UI is accurate on mount
    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
      <Timer className="w-4 h-4 text-slate-600" />
      <span className="font-mono font-semibold text-slate-800 text-sm">{timeLeft}</span>
    </div>
  );
};

export default PhaseTimer;