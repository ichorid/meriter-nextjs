'use client';

import { useEffect, useState, useRef } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => void | Promise<void>;
  threshold?: number; // Distance in pixels to trigger refresh
  enabled?: boolean;
}

interface PullToRefreshState {
  isPulling: boolean;
  distance: number;
  isRefreshing: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  enabled = true,
}: UsePullToRefreshOptions) {
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    distance: 0,
    isRefreshing: false,
  });

  const startY = useRef<number>(0);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at the top of the scrollable area
      const touch = e.touches?.[0];
      if (element.scrollTop === 0 && touch) {
        startY.current = touch.clientY;
        setState((prev) => ({ ...prev, isPulling: true }));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!state.isPulling) return;
      
      const touch = e.touches?.[0];
      if (!touch) return;

      const currentY = touch.clientY;
      const distance = Math.max(0, currentY - startY.current);

      // Prevent default scrolling if pulling down
      if (distance > 0 && element.scrollTop === 0) {
        e.preventDefault();
      }

      setState((prev) => ({
        ...prev,
        distance: Math.min(distance, threshold * 1.5), // Cap at 1.5x threshold
      }));
    };

    const handleTouchEnd = async () => {
      if (!state.isPulling) return;

      if (state.distance >= threshold && !state.isRefreshing) {
        setState((prev) => ({ ...prev, isRefreshing: true }));
        try {
          await onRefresh();
        } finally {
          setState({
            isPulling: false,
            distance: 0,
            isRefreshing: false,
          });
        }
      } else {
        setState({
          isPulling: false,
          distance: 0,
          isRefreshing: false,
        });
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, state.isPulling, state.distance, state.isRefreshing, threshold, onRefresh]);

  return {
    elementRef,
    pullDistance: state.distance,
    isPulling: state.isPulling,
    isRefreshing: state.isRefreshing,
    pullProgress: Math.min(state.distance / threshold, 1),
  };
}

