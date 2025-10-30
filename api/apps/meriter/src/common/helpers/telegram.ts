/**
 * Encode a deep link for Telegram
 * @param action - The action type (e.g., 'publication', 'community', 'poll')
 * @param id - Optional ID to include
 * @returns Encoded deep link string
 */
export function encodeTelegramDeepLink(action: string, id?: string): string {
  const data = id ? `${action}:${id}` : action;
  return Buffer.from(data).toString('base64url');
}

/**
 * Escape text for Telegram MarkdownV2
 * See: https://core.telegram.org/bots/api#markdownv2-style
 */
export function escapeMarkdownV2(text: string): string {
  if (!text) return '';
  return text.replace(/[\\_\*\[\]\(\)~`>#+\-=|{}\.!]/g, (m) => `\\${m}`);
}

/**
 * Build Mini App URL with raw startapp value (already encoded or plain action)
 */
export function buildMiniAppUrlFromStartApp(startapp: string, botUsername: string): string {
  return `https://t.me/${botUsername}?startapp=${startapp}`;
}

/**
 * Build Mini App URL using plain action and optional params as query string
 */
export function buildMiniAppUrl(action: string, params: Record<string, string | number> = {}, botUsername: string): string {
  const qs = new URLSearchParams(
    Object.entries(params).reduce((acc, [k, v]) => {
      acc[k] = String(v);
      return acc;
    }, {} as Record<string, string>)
  ).toString();
  return `https://t.me/${botUsername}?startapp=${action}${qs ? `&${qs}` : ''}`;
}

/**
 * Build Desktop URL from action mapping
 */
export function buildDesktopUrl(action: string, params: Record<string, string | number> = {}, baseUrl: string): string {
  const ensure = (p: string) => (p.startsWith('/') ? p : `/${p}`);
  switch (action) {
    case 'login':
      return `${baseUrl}/meriter/login`;
    case 'updates':
      return `${baseUrl}/meriter/home?updates=1`;
    case 'setup':
      return `${baseUrl}`;
    case 'publication': {
      // Prefer explicit desktopPath if provided; else build from ids
      const desktopPath = params['desktopPath'];
      if (desktopPath) return `${baseUrl}${ensure(String(desktopPath))}`;
      const communityId = params['communityId'];
      const slug = params['slug'] ?? params['id'];
      if (communityId && slug) return `${baseUrl}/meriter/communities/${communityId}?post=${slug}`;
      if (params['id']) return `${baseUrl}/meriter/publications/${params['id']}`;
      return `${baseUrl}/meriter/home`;
    }
    case 'community': {
      const id = params['id'];
      if (id) return `${baseUrl}/meriter/communities/${id}`;
      return `${baseUrl}/meriter/communities`;
    }
    case 'poll': {
      const id = params['id'];
      const communityId = params['communityId'];
      if (id && communityId) return `${baseUrl}/meriter/communities/${communityId}?poll=${id}`;
      if (id) return `${baseUrl}/meriter/communities?poll=${id}`;
      return `${baseUrl}/meriter/home`;
    }
    default:
      // Fallback: allow passing full or partial desktopPath
      const desktopPath = params['desktopPath'];
      return desktopPath ? `${baseUrl}${ensure(String(desktopPath))}` : `${baseUrl}/meriter/home`;
  }
}

/**
 * Produce compact dual links in MarkdownV2: [Web](...) [App](...)
 */
export function formatDualLinksFromEncoded(startappEncoded: string, desktopPath: string, botUsername: string, baseUrl: string): string {
  const webUrl = `${baseUrl}${desktopPath.startsWith('/') ? desktopPath : `/${desktopPath}`}`;
  const appUrl = buildMiniAppUrlFromStartApp(startappEncoded, botUsername);
  const web = `[Web](${webUrl})`;
  const app = `[App](${appUrl})`;
  return `${web} ${app}`;
}

export function formatDualLinks(action: string, params: Record<string, string | number> = {}, botUsername: string, baseUrl: string): string {
  const webUrl = buildDesktopUrl(action, params, baseUrl);
  const appUrl = buildMiniAppUrl(action, params, botUsername);
  const web = `[Web](${webUrl})`;
  const app = `[App](${appUrl})`;
  return `${web} ${app}`;
}
