import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    // Handle backward compatibility redirects
    // Redirect old /meriter/balance to new /meriter/home
    if (pathname === '/meriter/balance') {
        return NextResponse.redirect(new URL('/meriter/home', request.url));
    }
    
    // Redirect old /meriter/c/[id] to new /meriter/communities/[id]
    if (pathname.startsWith('/meriter/c/')) {
        const newPath = pathname.replace('/meriter/c/', '/meriter/communities/');
        return NextResponse.redirect(new URL(newPath, request.url));
    }
    
    // Redirect old space slugs like /meriter/[slug] to /meriter/spaces/[slug]
    // Only redirect if it's not a known static route
    const knownStaticRoutes = [
        '/meriter/login',
        '/meriter/home',
        '/meriter/manage',
        '/meriter/commbalance',
        '/meriter/setup-community',
        '/meriter/communities',
        '/meriter/spaces',
    ];
    
    if (pathname.startsWith('/meriter/') && 
        !knownStaticRoutes.some(route => pathname.startsWith(route)) &&
        pathname.split('/').length === 3) { // /meriter/[something]
        const slug = pathname.split('/')[2];
        if (slug && !slug.includes('.')) { // Not a file
            return NextResponse.redirect(new URL(`/meriter/spaces/${slug}`, request.url));
        }
    }
    
    // Public routes that don't require authentication
    const publicRoutes = ['/meriter/login'];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
    
    // API routes and static files are always allowed
    if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.startsWith('/meriter/')) {
        // For API routes, let them handle their own auth
        if (pathname.startsWith('/api/')) {
            return NextResponse.next();
        }
        
        // For public meriter routes
        if (isPublicRoute) {
            return NextResponse.next();
        }
    }
    
    // Let all other requests through - authentication is handled client-side
    // The pages themselves use SWR to check /api/rest/getme and redirect if needed
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};

