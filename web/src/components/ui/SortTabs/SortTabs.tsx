'use client';

import React from 'react';
import { Clock, TrendingUp } from 'lucide-react';

export type SortValue = 'recent' | 'voted';

interface SortTabsProps {
  value: SortValue;
  onChange: (value: SortValue) => void;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Unified sort toggle component with icon buttons
 * Used across the app for consistent sorting UX
 */
export const SortTabs: React.FC<SortTabsProps> = ({
  value,
  onChange,
  className = '',
  size = 'md',
}) => {
  const iconSize = size === 'sm' ? 14 : 16;
  const padding = size === 'sm' ? 'p-1.5' : 'p-2';

  return (
    <div className={`flex gap-0.5 bg-base-200/50 p-0.5 rounded-lg ${className}`}>
      <button
        onClick={() => onChange('recent')}
        className={`${padding} rounded-md transition-colors ${
          value === 'recent'
            ? 'bg-base-100 text-base-content shadow-sm [data-theme="dark"]:bg-base-200 [data-theme="dark"]:shadow-[0_1px_2px_0_rgba(255,255,255,0.1)]'
            : 'text-base-content/50 hover:text-base-content'
        }`}
        title="Sort by recent"
        aria-label="Sort by recent"
      >
        <Clock size={iconSize} />
      </button>
      <button
        onClick={() => onChange('voted')}
        className={`${padding} rounded-md transition-colors ${
          value === 'voted'
            ? 'bg-base-100 text-base-content shadow-sm [data-theme="dark"]:bg-base-200 [data-theme="dark"]:shadow-[0_1px_2px_0_rgba(255,255,255,0.1)]'
            : 'text-base-content/50 hover:text-base-content'
        }`}
        title="Sort by rating"
        aria-label="Sort by rating"
      >
        <TrendingUp size={iconSize} />
      </button>
    </div>
  );
};

