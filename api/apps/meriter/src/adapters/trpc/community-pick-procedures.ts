import { router } from '../../trpc/trpc';
import type { AnyRouter } from '@trpc/server';

/**
 * Build a slim tRPC sub-router with only whitelisted procedure names.
 * Works with @trpc/server v11 `_def.record`.
 */
export function pickProceduresRouter(
  source: AnyRouter,
  keys: string[],
  extra?: Parameters<typeof router>[0],
): ReturnType<typeof router> {
  const record =
    (source as { _def?: { record?: Record<string, unknown> } })._def?.record ??
    {};

  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (record[key]) {
      picked[key] = record[key];
    }
  }

  return router({
    ...picked,
    ...extra,
  } as Parameters<typeof router>[0]);
}
