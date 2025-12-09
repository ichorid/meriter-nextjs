'use client';

import React, { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

export interface DailyQuotaRingProps {
  remaining: number;
  max: number;
  onClick?: (e?: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  asDiv?: boolean; // If true, render as div instead of button (for use inside other buttons)
}

export const DailyQuotaRing: React.FC<DailyQuotaRingProps> = ({
  remaining,
  max,
  onClick,
  className = '',
  style,
  asDiv = false,
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

  const handleClick = (e: React.MouseEvent) => {
    if (onClick && !asDiv) {
      e.stopPropagation();
      e.preventDefault();
      // Stop immediate propagation to prevent other handlers
      if (e.nativeEvent && typeof (e.nativeEvent as any).stopImmediatePropagation === 'function') {
        (e.nativeEvent as any).stopImmediatePropagation();
      }
      onClick(e);
    }
  };

  // Also handle capture phase to stop propagation early
  const handleClickCapture = (e: React.MouseEvent) => {
    if (onClick && !asDiv) {
      e.stopPropagation();
    }
  };

  const commonProps = {
    onClick: asDiv ? undefined : handleClick,
    onClickCapture: asDiv ? undefined : handleClickCapture,
    className: `
      daily-quota-ring
      ${showPulse ? 'daily-quota-ring--pulse' : ''}
      ${className}
    `,
    style: { background, ...style },
    'aria-label': `Daily quota: ${remaining} of ${max} remaining`,
  };

  const innerContent = (
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
  );

  if (asDiv) {
    return (
      <div {...commonProps}>
        {innerContent}
      </div>
    );
  }

  return (
    <button
      {...commonProps}
      type="button"
    >
      {innerContent}
    </button>
  );
};

