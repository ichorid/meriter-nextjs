/**
 * Allows only in-app paths under /meriter/ (no protocol, no //).
 * Used for returnTo / back navigation query params.
 */
export function sanitizeMeriterInternalPath(path: string | null | undefined): string | undefined {
  if (!path || typeof path !== 'string') return undefined;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/meriter/')) return undefined;
  if (trimmed.includes('//')) return undefined;
  return trimmed;
}
