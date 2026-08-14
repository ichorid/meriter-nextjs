const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type UzzRuntimeConfig = Readonly<{
  apiBaseUrl: string;
  appBaseUrl: string;
  defaultCommunityId: string;
}>;

export function readUzzRuntimeConfig(
  env: Record<string, string | undefined>,
): UzzRuntimeConfig {
  const defaultCommunityId = env.DEFAULT_TELEGRAM_COMMUNITY_ID?.trim() ?? '';
  if (env.NODE_ENV === 'production' && !UUID_RE.test(defaultCommunityId)) {
    throw new Error('DEFAULT_TELEGRAM_COMMUNITY_ID must be a UUID in production');
  }
  return Object.freeze({
    apiBaseUrl: env.API_URL?.trim() ?? '',
    appBaseUrl: env.UZZ_WEB_BASE_URL?.trim() ?? '',
    defaultCommunityId,
  });
}
