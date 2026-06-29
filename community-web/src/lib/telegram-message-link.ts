/** Strip Telegram supergroup prefix for t.me/c/… deep links. */
export function supergroupLinkSegment(chatId: string): string | null {
  const id = chatId.trim();
  if (!id) return null;
  const superMatch = id.match(/^-100(\d+)$/);
  if (superMatch) return superMatch[1];
  const legacyMatch = id.match(/^-(\d+)$/);
  if (legacyMatch) return legacyMatch[1];
  return null;
}

export function buildTelegramMessageLink(
  chatId: string,
  messageId: number,
): string | null {
  if (!Number.isFinite(messageId) || messageId <= 0) return null;
  const segment = supergroupLinkSegment(chatId);
  if (!segment) return null;
  return `https://t.me/c/${segment}/${messageId}`;
}

export function openTelegramMessage(chatId: string, messageId: number): void {
  if (typeof window === 'undefined') return;
  const url = buildTelegramMessageLink(chatId, messageId);
  if (!url) return;

  const webApp = (
    window as Window & {
      Telegram?: {
        WebApp?: {
          openTelegramLink?: (url: string) => void;
          openLink?: (url: string) => void;
        };
      };
    }
  ).Telegram?.WebApp;

  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
    return;
  }
  if (webApp?.openLink) {
    webApp.openLink(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
