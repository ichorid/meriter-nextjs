import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Block accidental redirects to the main Meriter product domain. */
export function middleware(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get('return_to');
  if (returnTo && /meriter\.pro\/meriter/i.test(returnTo)) {
    return new NextResponse('Forbidden cross-product redirect', { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
