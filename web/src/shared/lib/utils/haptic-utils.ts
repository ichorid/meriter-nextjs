/**
 * Universal haptic feedback utility
 * Works in unknown environment - silently fails if not available
 */

export function hapticImpact(type: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' = 'light'): void {
  if (typeof window === 'undefined') return;
  
  try {
    const tgWebApp = (window as unknown).Telegram?.WebApp;
    if (tgWebApp?.HapticFeedback?.impactOccurred) {
      tgWebApp.HapticFeedback.impactOccurred(type);
    }
  } catch {
    // Silently fail - haptic feedback is optional
  }
}

export function hapticNotification(type: 'error' | 'success' | 'warning'): void {
  if (typeof window === 'undefined') return;
  
  try {
    const tgWebApp = (window as unknown).Telegram?.WebApp;
    if (tgWebApp?.HapticFeedback?.notificationOccurred) {
      tgWebApp.HapticFeedback.notificationOccurred(type);
    }
  } catch {
    // Silently fail - haptic feedback is optional
  }
}

// Legacy export for backward compatibility
export function safeHapticFeedback(
  type: 'success' | 'error' | 'warning',
  _isInTelegram: boolean // Deprecated parameter, kept for compatibility
): void {
  hapticNotification(type);
}