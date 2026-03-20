/**
 * Prevent open redirects: only same-app relative paths under /meriter/.
 */
export function safeMeriterReturnPath(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null;
  const t = path.trim();
  if (!t.startsWith('/meriter/') || t.includes('//')) return null;
  return t;
}
