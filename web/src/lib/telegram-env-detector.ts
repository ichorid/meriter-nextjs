/**
 * Telegram Environment Detection Utility
 * 
 * Detects if the app is running in Telegram Mini App mode using multiple signals.
 * Uses sessionStorage to cache the result and avoid re-detection.
 */

const STORAGE_KEY = 'tg_mini_app_detected';

export interface TelegramDetectionResult {
  isTelegramMiniApp: boolean;
  confidence: 'high' | 'medium' | 'low';
  signals: {
    hasTgWebAppData: boolean;
    hasTgWebAppStartParam: boolean;
    hasTelegramUserAgent: boolean;
    hasTelegramObject: boolean;
  };
}

/**
 * Detect if running in Telegram Mini App mode from URL parameters (server-side)
 */
export function detectFromURL(url: string): { isTelegramMiniApp: boolean; confidence: 'high' | 'medium' | 'low' } {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // /miniapplogin is always a Mini App route
    if (pathname === '/miniapplogin') {
      return { isTelegramMiniApp: true, confidence: 'high' };
    }
    
    const hasTgWebAppData = urlObj.searchParams.has('tgWebAppData');
    const hasTgWebAppStartParam = urlObj.searchParams.has('tgWebAppStartParam');
    
    if (hasTgWebAppData) {
      return { isTelegramMiniApp: true, confidence: 'high' };
    }
    
    if (hasTgWebAppStartParam) {
      return { isTelegramMiniApp: true, confidence: 'high' };
    }
    
    return { isTelegramMiniApp: false, confidence: 'low' };
  } catch {
    return { isTelegramMiniApp: false, confidence: 'low' };
  }
}

/**
 * Full detection including client-side checks
 * This should only be called in the browser
 */
export function detectTelegramEnvironment(): TelegramDetectionResult {
  // Check cached result first
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const cached = window.sessionStorage.getItem(STORAGE_KEY);
    if (cached === 'true' || cached === 'false') {
      return {
        isTelegramMiniApp: cached === 'true',
        confidence: 'medium',
        signals: {
          hasTgWebAppData: false,
          hasTgWebAppStartParam: false,
          hasTelegramUserAgent: false,
          hasTelegramObject: false,
        }
      };
    }
  }

  const signals = {
    hasTgWebAppData: false,
    hasTgWebAppStartParam: false,
    hasTelegramUserAgent: false,
    hasTelegramObject: false,
  };

  if (typeof window === 'undefined') {
    return {
      isTelegramMiniApp: false,
      confidence: 'low',
      signals
    };
  }

  // Check if we're on the /miniapplogin route - always Mini App mode
  try {
    if (window.location.pathname === '/miniapplogin') {
      return {
        isTelegramMiniApp: true,
        confidence: 'high',
        signals: {
          ...signals,
          hasTelegramObject: true, // Assume it's available
        }
      };
    }
  } catch {
    // Ignore
  }

  // Check URL parameters
  try {
    const urlParams = new URLSearchParams(window.location.search);
    signals.hasTgWebAppData = urlParams.has('tgWebAppData');
    signals.hasTgWebAppStartParam = urlParams.has('tgWebAppStartParam');
  } catch {
    // Ignore
  }

  // Check user agent
  try {
    const userAgent = navigator.userAgent || navigator.vendor || (window as unknown).opera;
    signals.hasTelegramUserAgent = /Telegram/i.test(userAgent);
  } catch {
    // Ignore
  }

  // Check for Telegram WebApp object
  try {
    signals.hasTelegramObject = typeof (window as unknown).Telegram !== 'undefined' && 
                                  typeof (window as unknown).Telegram?.WebApp !== 'undefined';
  } catch {
    // Ignore
  }

  // Determine if in Telegram Mini App based on signals
  let isTelegramMiniApp = false;
  let confidence: 'high' | 'medium' | 'low' = 'low';

  // High confidence signals
  if (signals.hasTgWebAppData || signals.hasTelegramObject) {
    isTelegramMiniApp = true;
    confidence = 'high';
  }
  // Medium confidence signal
  else if (signals.hasTgWebAppStartParam) {
    isTelegramMiniApp = true;
    confidence = 'medium';
  }
  // Low confidence signal
  else if (signals.hasTelegramUserAgent) {
    // User agent alone is not enough, but we check it
    isTelegramMiniApp = false; // Be conservative
    confidence = 'low';
  }

  // Cache the result
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.setItem(STORAGE_KEY, String(isTelegramMiniApp));
  }

  return {
    isTelegramMiniApp,
    confidence,
    signals
  };
}

/**
 * Force re-detection (for testing purposes)
 */
export function clearDetectionCache(): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}