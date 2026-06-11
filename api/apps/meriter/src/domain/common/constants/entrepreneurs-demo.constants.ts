export const ENTREPRENEURS_DEMO_PACK_ID = 'entrepreneurs' as const;
export const ENTREPRENEURS_DEMO_PACK_VERSION = 1 as const;
export const ENTREPRENEURS_DEMO_COMMUNITY_ID = 'demo_ent_community' as const;
export const ENTREPRENEURS_DEMO_ID_PREFIX = 'demo_ent_' as const;
export const DEMO_ENT_AUTH_PROVIDER = 'demo' as const;
export const DEMO_ENT_AUTH_PREFIX = 'demo_ent:' as const;

export function demoEntAuthId(login: string): string {
  return `${DEMO_ENT_AUTH_PREFIX}${login}`;
}

export function isDemoEntAuthId(authId: string): boolean {
  return authId.startsWith(DEMO_ENT_AUTH_PREFIX);
}

export function isDemoEntScopedId(id: string): boolean {
  return id.startsWith(ENTREPRENEURS_DEMO_ID_PREFIX);
}
