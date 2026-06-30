'use client';

export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  const tg = (window as Window & { Telegram?: { WebApp?: { initData?: string } } })
    .Telegram?.WebApp;
  return Boolean(tg?.initData);
}

/** Instagram / WeChat etc. — not Telegram Mini App */
export function isExternalCaptiveBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  if (isTelegramWebApp()) return false;
  const ua = navigator.userAgent;
  return /Instagram|FBAN|FBAV|Line|MicroMessenger/i.test(ua);
}

export function getTelegramInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const initData = (
    window as Window & { Telegram?: { WebApp?: { initData?: string } } }
  ).Telegram?.WebApp?.initData;
  return initData?.trim() ? initData : null;
}

export function getTelegramStartParam(): string | null {
  if (typeof window === 'undefined') return null;
  const unsafe = (
    window as Window & {
      Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: string } } };
    }
  ).Telegram?.WebApp?.initDataUnsafe;
  const param = unsafe?.start_param?.trim();
  return param || null;
}

export function parseTelegramChatIdFromInitData(initData: string): string | null {
  try {
    const chatJson = new URLSearchParams(initData).get('chat');
    if (!chatJson) return null;
    const chat = JSON.parse(chatJson) as { id?: number };
    return chat.id != null ? String(chat.id) : null;
  } catch {
    return null;
  }
}

export function hapticSuccess(): void {
  hapticNotification('success');
}

export function hapticError(): void {
  hapticNotification('error');
}

export function hapticWarning(): void {
  hapticNotification('warning');
}

export function hapticSelection(): void {
  try {
    getHapticFeedback()?.selectionChanged();
  } catch {
    /* ignore */
  }
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    getHapticFeedback()?.impactOccurred(style);
  } catch {
    /* ignore */
  }
}

function getHapticFeedback():
  | {
      notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
      impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
      selectionChanged: () => void;
    }
  | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window as Window & {
      Telegram?: { WebApp?: { HapticFeedback?: ReturnType<typeof getHapticFeedback> } };
    }
  ).Telegram?.WebApp?.HapticFeedback;
}

function hapticNotification(type: 'error' | 'success' | 'warning'): void {
  try {
    getHapticFeedback()?.notificationOccurred(type);
  } catch {
    /* ignore */
  }
}
