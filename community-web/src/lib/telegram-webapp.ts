type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const OBSIDIAN_HEADER = '#020617';
const OBSIDIAN_BACKGROUND = '#0f172a';

export function initTelegramWebApp(): void {
  if (typeof window === 'undefined') return;

  const webApp = window.Telegram?.WebApp;
  if (!webApp) return;

  webApp.ready();
  webApp.expand();
  webApp.setHeaderColor(OBSIDIAN_HEADER);
  webApp.setBackgroundColor(OBSIDIAN_BACKGROUND);
}
