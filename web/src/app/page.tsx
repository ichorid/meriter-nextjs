'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Root page component for static export
 * 
 * This component is rendered when:
 * 1. User is actually on the root path '/'
 * 2. Caddy serves index.html as fallback for other routes
 * 
 * When Caddy serves index.html for other routes (like /meriter/profile),
 * Next.js router will handle routing and render the correct page component.
 * 
 * We check the pathname and only act if we're actually on '/'.
 * This prevents interference when Caddy serves index.html for other routes.
 */
export default function Home() {
    const pathname = usePathname();
    const router = useRouter();

    // If we're not on the root path, return null immediately
    // This allows Next.js router to render the correct page when Caddy serves index.html
    // for routes other than '/'
    if (pathname !== '/') {
        return null;
    }

    useEffect(() => {
        // Only redirect if we're actually on the root path '/'
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

