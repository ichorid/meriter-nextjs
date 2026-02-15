import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/config';

/**
 * Magic link redirect: /a/[token] -> /api/v1/auth/link/[token]
 * Short path for SMS links. Uses config.app.url so redirect stays on the public origin.
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
  const apiPath = `${base}/api/v1/auth/link/${encodeURIComponent(token)}`;
  return NextResponse.redirect(apiPath, 302);
}
