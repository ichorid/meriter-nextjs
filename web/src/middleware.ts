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
  matcher: ['/create', '/pilot/multi-obraz', '/pilot/multi-obraz/:path*'],
};
