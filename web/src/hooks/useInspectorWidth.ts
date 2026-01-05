import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

const DEFAULT_INSPECTOR_WIDTH = 360;
const MIN_INSPECTOR_WIDTH = 240;
const MAX_INSPECTOR_WIDTH = 600;
const STORAGE_KEY = 'inspector-width';

/**
 * Hook to manage inspector sidebar width with localStorage persistence
 * Updates CSS variable --inspector-w dynamically
 */
export function useInspectorWidth() {
  const [width, setWidth] = useLocalStorage<number>(STORAGE_KEY, DEFAULT_INSPECTOR_WIDTH);

  // Clamp width to valid range
  const clampedWidth = Math.max(MIN_INSPECTOR_WIDTH, Math.min(MAX_INSPECTOR_WIDTH, width));

  // Update CSS variable when width changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--inspector-w', `${clampedWidth}px`);
    }
  }, [clampedWidth]);

  // Initialize CSS variable on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--inspector-w', `${clampedWidth}px`);
    }
  }, []);

  const setInspectorWidth = (newWidth: number) => {
    const clamped = Math.max(MIN_INSPECTOR_WIDTH, Math.min(MAX_INSPECTOR_WIDTH, newWidth));
    setWidth(clamped);
  };

  return {
    width: clampedWidth,
    setWidth: setInspectorWidth,
    minWidth: MIN_INSPECTOR_WIDTH,
    maxWidth: MAX_INSPECTOR_WIDTH,
  };
}

