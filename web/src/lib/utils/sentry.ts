/**
 * Sentry utility functions
 * 
 * Provides helper functions for setting user context and other Sentry operations
 */

import * as Sentry from '@sentry/nextjs';
import type { User } from '@/types/api-v1';

/**
 * Set user context in Sentry
 * Call this when user logs in or when user data changes
 */
export function setSentryUser(user: User | null): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  if (user) {
    Sentry.setUser({
      id: String(user.id),
      username: user.username || undefined,
      email: user.email || undefined,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Clear user context in Sentry
 * Call this when user logs out
 */
export function clearSentryUser(): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.setUser(null);
}

