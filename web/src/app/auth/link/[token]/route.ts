import { NextRequest, NextResponse } from 'next/server';

/**
 * Magic link redirect: /auth/link/[token] -> /api/v1/auth/link/[token]
 * So the link in SMS/email can point to the app domain (e.g. https://app.example.com/auth/link/TOKEN).
 * The API then sets the JWT cookie and redirects to profile.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.redirect(new URL('/meriter/login?error=link_expired', _request.url), 302);
  }
  const url = new URL(_request.url);
  const base = url.origin;
  const apiPath = `${base}/api/v1/auth/link/${encodeURIComponent(token)}`;
  return NextResponse.redirect(apiPath, 302);
}
