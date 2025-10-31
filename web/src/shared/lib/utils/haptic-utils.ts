/**
 * Utility functions for Telegram haptic feedback
 * Provides safe haptic feedback that only works in Telegram Mini App context
 */

import { hapticFeedback } from '@telegram-apps/sdk-react';

/**
 * Safely triggers haptic feedback notification
 * Only works when running in Telegram Mini App context
 * Silently fails if called outside Telegram context or if haptic feedback is unavailable
 * 
 * @param type - Type of notification ('success' | 'error' | 'warning')
 * @param isInTelegram - Whether the app is running in Telegram Mini App context
 */
export function safeHapticFeedback(
  type: 'success' | 'error' | 'warning',
  isInTelegram: boolean
): void {
  if (!isInTelegram) {
    return;
  }
  
  try {
    hapticFeedback.notificationOccurred(type);
  } catch (error) {
    // Silently fail - this is UX enhancement, not critical
    // Haptic feedback is optional and shouldn't break the app
    console.warn('Haptic feedback failed:', error);
  }
}

