/**
 * Hook to create stable memoized values that only change when dependencies actually change
 * Uses deep equality check to prevent unnecessary re-renders from object/array reference changes
 * 
 * This is useful when dependencies are objects/arrays that might be recreated with same values
 * 
 * Usage:
 *   const stableValue = useStableMemo(() => computeExpensiveValue(a, b), [a, b]);
 */

import { useMemo, useRef } from 'react';

/**
 * Deep equality check for objects and arrays
 * For primitives, uses === comparison
 */
function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a !== 'object') return false;

    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }

    return true;
}

/**
 * Creates a memoized value that only updates when dependencies deeply change
 * Prevents re-renders from object/array reference changes with same values
 */
export function useStableMemo<T>(
    factory: () => T,
    deps: React.DependencyList
): T {
    const prevDepsRef = useRef<React.DependencyList>([]);
    const prevValueRef = useRef<T | undefined>(undefined);

    return useMemo(() => {
        // Check if dependencies actually changed (deep equality)
        const depsChanged = deps.length !== prevDepsRef.current.length ||
            deps.some((dep, i) => !deepEqual(dep, prevDepsRef.current[i]));

        if (depsChanged) {
            prevDepsRef.current = deps;
            prevValueRef.current = factory();
        }

        return prevValueRef.current!;
    }, deps);
}

