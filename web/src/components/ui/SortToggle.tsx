'use client';

import React from 'react';
import { Clock, TrendingUp } from 'lucide-react';

export type SortOption = 'recent' | 'voted';

interface SortToggleProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  className?: string;
  /** Use compact icon-only style (default: true) */
  compact?: boolean;
}

/**
 * Unified sort toggle component for consistent sorting UI across the app.
 * Uses icons: Clock for "recent", TrendingUp for "voted/rating".
 */
export const SortToggle: React.FC<SortToggleProps> = ({
  value,
  onChange,
  className = '',
  compact = true,
}) => {
  const baseButtonClass = `
    flex items-center justify-center gap-1.5 rounded-lg transition-all duration-200
    ${compact ? 'p-2' : 'px-3 py-1.5'}
  `;
  
  const activeClass = `
    bg-base-100 text-base-content shadow-sm
    dark:bg-base-200 dark:shadow-[0_1px_2px_0_rgba(255,255,255,0.1)]
  `;
  
  const inactiveClass = `
    text-base-content/50 hover:text-base-content hover:bg-base-100/50
  `;

  return (
    <div className={`inline-flex gap-0.5 bg-base-200/50 p-0.5 rounded-lg ${className}`}>
      <button
        type="button"
        onClick={() => onChange('recent')}
        className={`${baseButtonClass} ${value === 'recent' ? activeClass : inactiveClass}`}
        aria-label="Sort by recent"
        aria-pressed={value === 'recent'}
      >
        <Clock size={16} />
      </button>
      <button
        type="button"
        onClick={() => onChange('voted')}
        className={`${baseButtonClass} ${value === 'voted' ? activeClass : inactiveClass}`}
        aria-label="Sort by rating"
        aria-pressed={value === 'voted'}
      >
        <TrendingUp size={16} />
      </button>
    </div>
  );
};

export default SortToggle;

