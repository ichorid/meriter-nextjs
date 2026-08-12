/** Meriter product isolation (full / community-web / uzz-web). */

export const MERITER_PRODUCT_HEADER = 'x-meriter-product' as const;

export type MeriterProduct = 'full' | 'community' | 'uzz';

export const COMMUNITY_SESSION_COOKIE = 'meriter_community_session' as const;

export const UZZ_SESSION_COOKIE = 'meriter_uzz_session' as const;

export const FULL_SESSION_COOKIE = 'jwt' as const;

export function parseMeriterProductHeader(
  value: string | string[] | undefined,
): MeriterProduct | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'community') return 'community';
  if (normalized === 'uzz') return 'uzz';
  if (normalized === 'full') return 'full';
  return undefined;
}

export function resolveMeriterProductFromRequest(req: {
  url?: string;
  path?: string;
  headers?: Record<string, unknown>;
}): MeriterProduct {
  const headerProduct = parseMeriterProductHeader(
    req.headers?.[MERITER_PRODUCT_HEADER] as string | string[] | undefined,
  );
  if (headerProduct) return headerProduct;

  const path = req.url ?? req.path ?? '';
  if (path.includes('/trpc/uzz')) return 'uzz';
  if (path.includes('/trpc/community')) return 'community';
  return 'full';
}
