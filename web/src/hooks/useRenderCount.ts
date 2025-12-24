/**
 * Hook to track component render count for debugging
 * Helps detect infinite re-render loops and excessive renders
 * 
 * Usage:
 *   const renderCount = useRenderCount('ComponentName');
 *   // Will log warnings if renders exceed threshold
 * 
 * In production, this hook is a no-op to avoid performance overhead
 */

import { useEffect, useRef } from 'react';

interface UseRenderCountOptions {
    /**
     * Component name for logging
     */
    name?: string;
    /**
     * Maximum number of renders before warning (default: 50)
     */
    warnThreshold?: number;
    /**
     * Maximum number of renders before error (default: 100)
     */
    errorThreshold?: number;
    /**
     * Whether to log all renders (default: false, only logs warnings/errors)
     */
    logAll?: boolean;
}

export function useRenderCount(options: UseRenderCountOptions = {}) {
    const {
        name = 'Component',
        warnThreshold = 50,
        errorThreshold = 100,
        logAll = false,
    } = options;

    const renderCountRef = useRef(0);
    const isDevelopment = process.env.NODE_ENV === 'development';

    renderCountRef.current += 1;
    const currentCount = renderCountRef.current;

    useEffect(() => {
        // In production, skip all logic to avoid overhead
        if (!isDevelopment) return;

        if (logAll) {
            console.log(`[RenderCount] ${name}: render #${currentCount}`);
        }

        if (currentCount === warnThreshold) {
            console.warn(
                `[RenderCount] ${name}: Excessive renders detected (${currentCount}). ` +
                `This may indicate an infinite re-render loop. Check dependencies in useEffect, useMemo, useCallback.`
            );
        }

        if (currentCount >= errorThreshold) {
            console.error(
                `[RenderCount] ${name}: CRITICAL - Render count exceeded error threshold (${currentCount}). ` +
                `This is likely an infinite re-render loop. Component: ${name}`
            );
            
            // In development, throw error to break the loop and make it obvious
            if (currentCount === errorThreshold) {
                throw new Error(
                    `Infinite re-render loop detected in ${name}. ` +
                    `Component has rendered ${currentCount} times. ` +
                    `Check for: unstable dependencies, missing memoization, or state updates in render.`
                );
            }
        }
    }, [currentCount, name, warnThreshold, errorThreshold, logAll, isDevelopment]);

    return currentCount;
}

