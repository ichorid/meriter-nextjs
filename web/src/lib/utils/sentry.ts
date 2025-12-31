/**
 * Sentry utility functions
 * 
 * Provides helper functions for setting user context and other Sentry operations
 */

import * as Sentry from '@sentry/nextjs';
import type { User } from '@/types/api-v1';
import config from '@/config';

/**
 * Set user context in Sentry
 * Call this when user logs in or when user data changes
 */
export function setSentryUser(user: User | null): void {
  // Safe access for test environment where config might not be fully initialized
  if (!config?.sentry?.enabled) {
    return;
  }

  if (user) {
    Sentry.setUser({
      id: String(user.id),
      username: user.username || undefined,
      email: user.profile?.contacts?.email || undefined,
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
  // Safe access for test environment where config might not be fully initialized
  if (!config?.sentry?.enabled) {
    return;
  }

  Sentry.setUser(null);
}
