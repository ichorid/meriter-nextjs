/**
 * Per-test suppression of expected error logs.
 *
 * Goal: avoid spamming console output in tests that intentionally trigger errors
 * (e.g., FORBIDDEN / BAD_REQUEST), while keeping unexpected errors visible.
 *
 * This is intentionally global (process-wide) because Jest e2e config uses
 * maxWorkers=1. Cleanup is enforced via `withSuppressedErrors(..., fn)` which
 * resets suppression in a `finally` block.
 */

type SuppressableTrpcCode = 'FORBIDDEN' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'BAD_REQUEST';

const suppressedCodes: Set<SuppressableTrpcCode> = new Set();

export function suppressExpectedErrors(codes: readonly SuppressableTrpcCode[]): void {
  for (const code of codes) {
    suppressedCodes.add(code);
  }
}

export function restoreErrorLogging(): void {
  suppressedCodes.clear();
}

export function shouldSuppressError(code: unknown): boolean {
  if (typeof code !== 'string') {
    return false;
  }
  // Only suppress the explicitly supported codes.
  return suppressedCodes.has(code as SuppressableTrpcCode);
}

export async function withSuppressedErrors<T>(
  codes: readonly SuppressableTrpcCode[],
  fn: () => Promise<T>,
): Promise<T> {
  suppressExpectedErrors(codes);
  try {
    return await fn();
  } finally {
    restoreErrorLogging();
  }
}


