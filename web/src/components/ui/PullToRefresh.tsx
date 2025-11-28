'use client';

import React from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => void | Promise<void>;
  threshold?: number;
  enabled?: boolean;
  className?: string;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  enabled = true,
  className = '',
}: PullToRefreshProps) {
  const { elementRef, pullDistance, isPulling, isRefreshing, pullProgress } = usePullToRefresh({
    onRefresh,
    threshold,
    enabled,
  });

  return (
    <div ref={elementRef} className={`relative ${className}`}>
      {/* Pull indicator */}
      {isPulling && (
        <div
          className="fixed top-0 left-0 right-0 flex items-center justify-center z-50 bg-white/90 backdrop-blur-sm"
          style={{
            height: `${Math.min(pullDistance, threshold * 1.5)}px`,
            transform: `translateY(${Math.min(pullDistance - threshold, 0)}px)`,
            transition: 'transform 0.2s ease-out',
          }}
        >
          {pullProgress >= 1 ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              <span className="text-sm text-brand-text-secondary">Release to refresh</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full"
                style={{
                  transform: `rotate(${pullProgress * 360}deg)`,
                  transition: 'transform 0.1s ease-out',
                }}
              />
              <span className="text-sm text-brand-text-secondary">
                Pull to refresh ({Math.round(pullProgress * 100)}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Refreshing indicator */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 flex items-center justify-center z-50 bg-white/90 backdrop-blur-sm h-16">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            <span className="text-sm text-brand-text-secondary">Refreshing...</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        style={{
          transform: isPulling ? `translateY(${Math.min(pullDistance, threshold)}px)` : 'translateY(0)',
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}

