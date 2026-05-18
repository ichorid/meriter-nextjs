import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRootRedirectPath } from '@/lib/routing/routing-utils';

/**
 * Root `/` redirect at the edge. Avoids `redirect()` in app/page.tsx, which triggers
 * Next.js 16 dev performance.measure errors for the page component (e.g. "Home").
 */
export function middleware(request: NextRequest) {
  const tgWebAppStartParam = request.nextUrl.searchParams.get('tgWebAppStartParam');
  const hasJwt = Boolean(request.cookies.get('jwt')?.value);

  const targetPath = getRootRedirectPath({
    hasJwt,
    tgWebAppStartParam,
  });

  return NextResponse.redirect(new URL(targetPath, request.url));
}

export const config = {
  matcher: '/',
};
