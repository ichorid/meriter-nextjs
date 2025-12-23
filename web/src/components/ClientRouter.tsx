'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Client-side router component that replaces Next.js middleware
 * Handles redirects that were previously done server-side
 */
export function ClientRouter() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!pathname) return;
        
        // Handle root path redirects
        if (pathname === '/') {
            const tgWebAppStartParam = searchParams?.get('tgWebAppStartParam');
            
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
            router.replace('/meriter/profile');
            return;
        }

        if (pathname.startsWith('/meriter/c/')) {
            const newPath = pathname.replace('/meriter/c/', '/meriter/communities/');
            router.replace(newPath);
            return;
        }

        // Handle old space slug redirects
        const knownStaticRoutes = [
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

        if (
            pathname.startsWith('/meriter/') &&
            !knownStaticRoutes.some(route => pathname.startsWith(route)) &&
            pathname.split('/').length === 3
        ) {
            const slug = pathname.split('/')[2];
            if (slug && !slug.includes('.')) {
                // Not a file - redirect to spaces
                router.replace(`/meriter/spaces/${slug}`);
                return;
            }
        }
    }, [pathname, router, searchParams]);

    // This component doesn't render anything
    return null;
}

