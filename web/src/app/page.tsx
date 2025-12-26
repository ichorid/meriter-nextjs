'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Root page component for static export
 * 
 * This component is rendered when:
 * 1. User is actually on the root path '/'
 * 2. Caddy serves index.html as fallback for other routes
 * 
 * When Caddy serves index.html for other routes (like /meriter/profile),
 * we check window.location.pathname directly and return null immediately
 * to allow Next.js router to render the correct page component.
 */
export default function Home() {
    const router = useRouter();

    // Check the actual browser pathname directly and synchronously
    // This is more reliable than usePathname() when Caddy serves index.html
    // We need to check this in the component body, not in useEffect,
    // to prevent the root page from rendering when we're not on '/'
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        // Not on root path - return null immediately to let Next.js router handle it
        return null;
    }

    useEffect(() => {
        // Only run if we're actually on the root path '/'
        // ClientRouter will also handle this, but we do it here as well
        // to ensure it happens even if ClientRouter hasn't run yet
        const tgWebAppStartParam = new URLSearchParams(window.location.search).get('tgWebAppStartParam');
        
        if (tgWebAppStartParam) {
            router.replace(`/meriter/login?tgWebAppStartParam=${encodeURIComponent(tgWebAppStartParam)}`);
            return;
        }

        // Check JWT cookie
        const jwtCookie = document.cookie.split('; ').find(row => row.startsWith('jwt='));
        if (jwtCookie) {
            router.replace('/meriter/profile');
        } else {
            router.replace('/meriter/login');
        }
    }, [router]);

    // Return null while redirecting
    return null;
}

