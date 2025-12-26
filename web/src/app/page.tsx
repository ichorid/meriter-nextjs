'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Root page component for static export
 * 
 * This component is only rendered when the user is actually on the root path '/'.
 * When Caddy serves index.html for other routes (like /meriter/profile),
 * Next.js router handles the routing and renders the correct page component.
 * 
 * We redirect to profile when on root path. ClientRouter also handles this,
 * but this ensures it happens even if ClientRouter hasn't run yet.
 */
export default function Home() {
    const router = useRouter();

    useEffect(() => {
        // Only redirect if we're actually on root path
        // Check window.location.pathname directly for reliability
        if (typeof window !== 'undefined' && window.location.pathname === '/') {
            router.replace('/meriter/profile');
        }
    }, [router]);

    // Return empty fragment - Next.js router will handle rendering the correct page
    // This allows hydration without interfering with routing
    return <></>;
}

