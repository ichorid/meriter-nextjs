export function buildTelegramMessageLink(
  chatId: string,
  messageId: number,
): string | null {
  const id = chatId.trim();
  if (!id || !Number.isFinite(messageId) || messageId <= 0) return null;
  if (id.startsWith('-100')) {
    return `https://t.me/c/${id.slice(4)}/${messageId}`;
  }
  return null;
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
