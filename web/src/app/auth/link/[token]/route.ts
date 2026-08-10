import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/config';

/**
 * Legacy magic-link path: /auth/link/[token] -> /a/[token] (canonical entry).
 * Preserves existing links in email/SMS; token TTL remains governed by API redeem (inv-24 15m).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const base = config.app.url.replace(/\/$/, '');
  if (!token) {
    return NextResponse.redirect(`${base}/meriter/login?error=link_expired`, 302);
  }
  const canonicalPath = `/a/${encodeURIComponent(token)}`;
  return NextResponse.redirect(`${base}${canonicalPath}`, 302);
}
