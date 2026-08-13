import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Keep the standalone pilot from redirecting into the main Meriter product. */
export function proxy(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get('return_to');
  if (returnTo && /meriter\.pro\/meriter/i.test(returnTo)) {
    return new NextResponse('Forbidden cross-product redirect', { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
