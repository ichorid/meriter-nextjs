import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Handle Telegram Web App deep links at root
    if (pathname === "/") {
        const tgWebAppStartParam =
            request.nextUrl.searchParams.get("tgWebAppStartParam");

        if (tgWebAppStartParam) {
            // Redirect to login, preserving the tgWebAppStartParam
            // The login page will extract start_param from Telegram.WebApp.initDataUnsafe
            const loginUrl = new URL("/meriter/login", request.url);
            loginUrl.searchParams.set("tgWebAppStartParam", tgWebAppStartParam);
            return NextResponse.redirect(loginUrl);
        }

        // Check for JWT cookie - if exists, redirect to profile, otherwise to login
        // AuthWrapper will handle showing login page if 401 occurs
        const jwtCookie = request.cookies.get("jwt");
        if (jwtCookie) {
            const profileUrl = new URL("/meriter/profile", request.url);
            return NextResponse.redirect(profileUrl);
        } else {
            // No JWT cookie - redirect to login, AuthWrapper will handle 401 from /me
            const loginUrl = new URL("/meriter/login", request.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    // Handle locale cookie setting
    const localeCookie = request.cookies.get("NEXT_LOCALE");
    if (!localeCookie) {
        // Set default locale cookie on first visit
        const acceptLanguage = request.headers.get("accept-language");
        const browserLang = acceptLanguage
            ?.split(",")[0]
            ?.split("-")[0]
            ?.toLowerCase();
        const detectedLocale = browserLang === "ru" ? "ru" : "en";

        const response = NextResponse.next();
        response.cookies.set("NEXT_LOCALE", detectedLocale, {
            maxAge: 365 * 24 * 60 * 60, // 1 year
            path: "/",
            sameSite: "lax",
            httpOnly: false, // Allow client-side access
        });
        return response;
    }

    // Handle backward compatibility redirects
    // Redirect old /meriter/balance to new /meriter/profile
    if (pathname === "/meriter/balance") {
        return NextResponse.redirect(new URL("/meriter/profile", request.url));
    }

    // Redirect old /meriter/home to new /meriter/profile
    if (pathname === "/meriter/home") {
        return NextResponse.redirect(new URL("/meriter/profile", request.url));
    }

    // Redirect old /meriter/c/[id] to new /meriter/communities/[id]
    if (pathname.startsWith("/meriter/c/")) {
        const newPath = pathname.replace(
            "/meriter/c/",
            "/meriter/communities/"
        );
        return NextResponse.redirect(new URL(newPath, request.url));
    }

    // Redirect old space slugs like /meriter/[slug] to /meriter/spaces/[slug]
    // Only redirect if it's not a known static route
    const knownStaticRoutes = [
        "/meriter/login",
        "/meriter/communities",
        "/meriter/spaces",
        "/meriter/settings",
        "/meriter/profile",
        "/meriter/new-user",
        "/meriter/welcome",
        "/meriter/search",
        "/meriter/notifications",
        "/meriter/invite",
        "/meriter/invites",
        "/meriter/teams",
        "/meriter/about",
    ];

    if (
        pathname.startsWith("/meriter/") &&
        !knownStaticRoutes.some((route) => pathname.startsWith(route)) &&
        pathname.split("/").length === 3
    ) {
        // /meriter/[something]
        const slug = pathname.split("/")[2];
        if (slug && !slug.includes(".")) {
            // Not a file
            return NextResponse.redirect(
                new URL(`/meriter/spaces/${slug}`, request.url)
            );
        }
    }

    // Public routes that don't require authentication
    const publicRoutes = ["/meriter/login"];
    const isPublicRoute = publicRoutes.some((route) =>
        pathname.startsWith(route)
    );

    // API routes and static files are always allowed
    if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
        return NextResponse.next();
    }

    // Protect /meriter/* routes (except public ones) by requiring JWT cookie
    if (pathname.startsWith("/meriter/")) {
        if (isPublicRoute) {
            // Allow access to login page without auth
            return NextResponse.next();
        }

        // Check for JWT cookie set by backend (CookieManager uses 'jwt' name)
        const jwtCookie = request.cookies.get("jwt");

        // If no JWT cookie, allow request to proceed - AuthWrapper will handle showing login page
        // This allows client-side rendering and better UX
        if (!jwtCookie) {
            return NextResponse.next();
        }

        // JWT cookie exists - allow request, backend will validate token
        return NextResponse.next();
    }

    // Let all other requests through
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
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
