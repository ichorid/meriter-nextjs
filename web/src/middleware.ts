import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function pilotRoutesEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_PILOT_MODE === 'true' ||
    process.env.NEXT_PUBLIC_PILOT_MODE === '1'
  );
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith('/pilot/multi-obraz') && !pilotRoutesEnabled()) {
    return new NextResponse(null, { status: 404, statusText: 'Not Found' });
  }

  if (pilotRoutesEnabled()) {
    // Canonical pilot dream route: avoid /meriter/projects/:id to prevent full-Meriter layout flash.
    if (path.startsWith('/meriter/projects/') && path.split('/').length === 4) {
      const id = path.split('/')[3];
      return NextResponse.redirect(new URL(`/dreams/${id}`, request.url));
    }

    // Pilot hard guard: do not allow falling into the full Meriter UI.
    // Whitelist only routes that are intentionally reused by the pilot shell.
    if (path.startsWith('/meriter/')) {
      const allow =
        path === '/meriter/login' ||
        path.startsWith('/meriter/login/') ||
        path === '/meriter/auth/callback' ||
        path.startsWith('/meriter/auth/callback/') ||
        path === '/meriter/about' ||
        path.startsWith('/meriter/about/') ||
        path === '/meriter/projects' ||
        path.startsWith('/meriter/projects/');

      if (!allow) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    // Prevent falling into the full Meriter chrome in pilot builds.
    if (path === '/meriter/profile' || path.startsWith('/meriter/profile/')) {
      return NextResponse.redirect(new URL('/profile', request.url));
    }
    if (path === '/meriter/projects/create' || path === '/meriter/projects/create/') {
      return NextResponse.redirect(new URL('/create', request.url));
    }
    if (path === '/pilot/multi-obraz' || path === '/pilot/multi-obraz/') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (path === '/pilot/multi-obraz/create' || path === '/pilot/multi-obraz/create/') {
      return NextResponse.redirect(new URL('/create', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/create',
    '/dreams/:path*',
    '/profile',
    '/mining',
    '/meriter/profile',
    '/meriter/profile/:path*',
    '/meriter/projects/create',
    '/meriter/:path*',
    '/pilot/multi-obraz',
    '/pilot/multi-obraz/:path*',
  ],
};
