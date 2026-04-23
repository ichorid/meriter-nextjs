import * as Sentry from '@sentry/nextjs';

import config from '@/config';
import { isPilotClientMode } from '@/config/pilot';

const release =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_BUILD_SHA ??
  'dev';

/**
 * TR-12 lightweight product signals (Sentry breadcrumbs when enabled). No PII / comment bodies.
 */
export function trackPilotProductEvent(
  event: string,
  fields: Record<string, string | number | undefined>,
): void {
  if (!isPilotClientMode() || typeof window === 'undefined') {
    return;
  }
  const data = { event, ts: Date.now(), release, ...fields };
  if (config.sentry?.enabled) {
    Sentry.addBreadcrumb({
      category: 'ui.pilot',
      message: event,
      level: 'info',
      data,
    });
  }
}
