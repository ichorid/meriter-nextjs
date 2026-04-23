/**
 * tRPC / React Query: classify errors so we do not retry or refetch in a tight loop
 * (e.g. stale URL with deleted community → NOT_FOUND storm).
 */

export function isNotFoundTrpcError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { data?: { code?: string } }).data?.code;
  return code === 'NOT_FOUND';
}

/** Client / validation errors that should not trigger automatic retries. */
export function isNonRetryableTrpcQueryError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { data?: { code?: string } }).data?.code;
  return code === 'NOT_FOUND' || code === 'BAD_REQUEST' || code === 'FORBIDDEN';
}
