import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    // Log the full URL that was passed to the server
    console.log('🌐 Full URL:', request.url);
    console.log('📍 Pathname:', pathname);
    console.log('🔍 Search params:', request.nextUrl.searchParams.toString());
    console.log('🌍 Host:', request.nextUrl.host);
    console.log('📋 Headers:', Object.fromEntries(request.headers.entries()));
    console.log('---');
    
    // Handle Telegram Web App deep links at root
    if (pathname === '/') {
        const tgWebAppStartParam = request.nextUrl.searchParams.get('tgWebAppStartParam');
        
        if (tgWebAppStartParam) {
            console.log('🔗 Telegram Web App deep link detected, redirecting to login');
            // Redirect to login, preserving the tgWebAppStartParam
            // The login page will extract start_param from Telegram.WebApp.initDataUnsafe
            const loginUrl = new URL('/meriter/login', request.url);
            loginUrl.searchParams.set('tgWebAppStartParam', tgWebAppStartParam);
            return NextResponse.redirect(loginUrl);
        }
        
        // Regular non-Telegram users go to home
        const homeUrl = new URL('/meriter/home', request.url);
        return NextResponse.redirect(homeUrl);
    }
    
    // Handle locale cookie setting
    const localeCookie = request.cookies.get('NEXT_LOCALE');
    if (!localeCookie) {
        // Set default locale cookie on first visit
        const acceptLanguage = request.headers.get('accept-language');
        const browserLang = acceptLanguage?.split(',')[0]?.split('-')[0]?.toLowerCase();
        const detectedLocale = browserLang === 'ru' ? 'ru' : 'en';
        
        const response = NextResponse.next();
        response.cookies.set('NEXT_LOCALE', detectedLocale, {
            maxAge: 365 * 24 * 60 * 60, // 1 year
            path: '/',
            sameSite: 'lax',
            httpOnly: false, // Allow client-side access
        });
        return response;
    }
    
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
        '/meriter/communities',
        '/meriter/spaces',
        '/meriter/settings',
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

