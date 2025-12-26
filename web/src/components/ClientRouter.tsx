'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getRouteRedirect, requiresRouteProcessing } from '@/lib/routing/routing-utils';

/**
 * Client-side router component that replaces Next.js middleware
 * Handles redirects that were previously done server-side
 * 
 * Uses centralized routing utilities for all redirect logic
 */
export function ClientRouter() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    
    // Extract search param value to avoid unstable object reference in dependencies
    // useSearchParams() returns a new object on each render, but the actual param value is stable
    const tgWebAppStartParam = searchParams?.get('tgWebAppStartParam');
    
    // Use ref to track the last processed pathname to prevent infinite loops
    // This ensures we only process each pathname once
    const lastProcessedPathnameRef = useRef<string | null>(null);

    useEffect(() => {
        if (!pathname) return;
        
        // Skip if we've already processed this exact pathname
        // This prevents infinite loops when router.replace() triggers re-renders
        if (lastProcessedPathnameRef.current === pathname) {
            return;
        }

        // Optimize: only process routes that need redirects
        // This reduces unnecessary processing for most routes
        if (!requiresRouteProcessing(pathname) && pathname !== '/') {
            lastProcessedPathnameRef.current = pathname;
            return;
        }
        
        // Get redirect decision from centralized utility
        const redirectResult = getRouteRedirect({
            pathname,
            searchParams,
            tgWebAppStartParam: tgWebAppStartParam || null,
        });

        if (redirectResult.shouldRedirect && redirectResult.targetPath) {
            lastProcessedPathnameRef.current = pathname;
            router.replace(redirectResult.targetPath);
            return;
        }
        
        // Mark this pathname as processed (even if no redirect was needed)
        lastProcessedPathnameRef.current = pathname;
    }, [pathname, router, searchParams, tgWebAppStartParam]);

    // This component doesn't render anything
    return null;
}

