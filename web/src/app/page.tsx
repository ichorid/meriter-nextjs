'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function Home() {
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        // Only redirect to profile if we're actually on the root path
        // Don't interfere with client-side routing for dynamic routes
        if (pathname === '/') {
            router.replace('/meriter/profile');
        }
    }, [pathname, router]);

    // Return null to let Next.js router handle the route if not on root
    return null;
}

