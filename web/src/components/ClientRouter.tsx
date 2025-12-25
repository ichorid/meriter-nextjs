'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Client-side router component that replaces Next.js middleware
 * Handles redirects that were previously done server-side
 */
const KNOWN_STATIC_ROUTES = [
  '/meriter/login',
  '/meriter/communities',
  '/meriter/spaces',
  '/meriter/settings',
  '/meriter/profile',
  '/meriter/new-user',
  '/meriter/welcome',
  '/meriter/search',
  '/meriter/notifications',
  '/meriter/invite',
  '/meriter/invites',
  '/meriter/teams',
  '/meriter/about',
];

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
        
        // Handle root path redirects
        if (pathname === '/') {
            lastProcessedPathnameRef.current = pathname;
            
            if (tgWebAppStartParam) {
                router.replace(`/meriter/login?tgWebAppStartParam=${encodeURIComponent(tgWebAppStartParam)}`);
                return;
            }

            // Check JWT cookie
            const jwtCookie = document.cookie
                .split('; ')
                .find(row => row.startsWith('jwt='));
            
            if (jwtCookie) {
                router.replace('/meriter/profile');
            } else {
                router.replace('/meriter/login');
            }
            return;
        }

        // Handle backward compatibility redirects
        if (pathname === '/meriter/balance' || pathname === '/meriter/home') {
            lastProcessedPathnameRef.current = pathname;
            router.replace('/meriter/profile');
            return;
        }

        if (pathname.startsWith('/meriter/c/')) {
            const newPath = pathname.replace('/meriter/c/', '/meriter/communities/');
            lastProcessedPathnameRef.current = pathname;
            router.replace(newPath);
            return;
        }

        // Handle old space slug redirects
        if (
            pathname.startsWith('/meriter/') &&
            !KNOWN_STATIC_ROUTES.some(route => pathname.startsWith(route)) &&
            pathname.split('/').length === 3
        ) {
            const slug = pathname.split('/')[2];
            if (slug && !slug.includes('.')) {
                // Not a file - redirect to spaces
                lastProcessedPathnameRef.current = pathname;
                router.replace(`/meriter/spaces/${slug}`);
                return;
            }
        }
        
        // Mark this pathname as processed (even if no redirect was needed)
        lastProcessedPathnameRef.current = pathname;
    }, [pathname, router, tgWebAppStartParam]);

    // This component doesn't render anything
    return null;
}

