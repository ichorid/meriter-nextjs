'use client';

import React, { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

export interface DailyQuotaRingProps {
  remaining: number;
  max: number;
  onClick?: () => void;
  className?: string;
}

export const DailyQuotaRing: React.FC<DailyQuotaRingProps> = ({
  remaining,
  max,
  onClick,
  className = '',
}) => {
  const prevRemainingRef = useRef(remaining);
  const numberRef = useRef<HTMLSpanElement>(null);

  // Trigger number scale animation when remaining changes
  useEffect(() => {
    if (prevRemainingRef.current !== remaining && numberRef.current) {
      numberRef.current.classList.add('quota-number-change');
      const timer = setTimeout(() => {
        numberRef.current?.classList.remove('quota-number-change');
      }, 300);
      return () => clearTimeout(timer);
    }
    prevRemainingRef.current = remaining;
  }, [remaining]);

  // Calculate ratio and color
  const ratio = max > 0 ? Math.max(0, Math.min(remaining / max, 1)) : 0;
  
  const color =
    remaining === 0
      ? '#D4D4D8' // grey
      : ratio > 0.7
      ? '#22C55E' // green
      : ratio > 0.3
      ? '#EAB308' // yellow
      : '#F97316'; // orange/red

  const angle = ratio * 360;
  
  // Background for the ring using conic-gradient
  const background =
    remaining === 0
      ? '#F4F4F5' // neutral grey background when empty
      : `conic-gradient(${color} 0deg ${angle}deg, #E4E4E7 ${angle}deg 360deg)`;

  const showPulse = remaining > 0;
  const isComplete = remaining === 0 && max > 0;

  return (
    <button
      onClick={onClick}
      className={`
        daily-quota-ring
        ${showPulse ? 'daily-quota-ring--pulse' : ''}
        ${className}
      `}
      style={{ background }}
      type="button"
      aria-label={`Daily quota: ${remaining} of ${max} remaining`}
    >
      {/* Inner disc */}
      <div className="daily-quota-ring__inner">
        {isComplete ? (
          <Check className="daily-quota-ring__checkmark" size={14} />
        ) : (
          <span
            ref={numberRef}
            className="daily-quota-ring__number"
          >
            {remaining}
          </span>
        )}
      </div>
    </button>
  );
};

