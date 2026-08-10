/** Stable IDs for local community-web dev seed (never use in production). */
export const COMMUNITY_WEB_DEV_COMMUNITY_ID =
  'a1000001-0000-4000-8000-000000000001';

export const COMMUNITY_WEB_DEV_PROJECT_ID =
  'a1000002-0000-4000-8000-000000000002';

export const COMMUNITY_WEB_DEV_LEAD_USER_ID =
  'a1000003-0000-4000-8000-000000000003';

export const COMMUNITY_WEB_DEV_PARTICIPANT_USER_ID =
  'a1000004-0000-4000-8000-000000000004';

export const COMMUNITY_WEB_DEV_MEMBER_3_USER_ID =
  'a1000005-0000-4000-8000-000000000005';

export const COMMUNITY_WEB_DEV_MEMBER_4_USER_ID =
  'a1000006-0000-4000-8000-000000000006';

export const COMMUNITY_WEB_DEV_MEMBER_5_USER_ID =
  'a1000007-0000-4000-8000-000000000007';

export const COMMUNITY_WEB_DEV_LEAD_AUTH_ID = 'community_web_dev_lead';
export const COMMUNITY_WEB_DEV_PARTICIPANT_AUTH_ID = 'community_web_dev_participant';

export const COMMUNITY_WEB_DEV_TELEGRAM_CHAT_ID = '-1009990000001';

export const COMMUNITY_WEB_DEV_AUTH_PROVIDER = 'fake' as const;

/** Prefix for seeded demo content (idempotent wipe / detection). */
export const COMMUNITY_WEB_DEV_CONTENT_MARKER = '[cw-dev]';

export const COMMUNITY_WEB_DEV_STARTING_MERITS = 75;

export const COMMUNITY_WEB_DEV_EXTRA_MEMBERS = [
  {
    id: COMMUNITY_WEB_DEV_MEMBER_3_USER_ID,
    authId: 'community_web_dev_member_3',
    username: 'cw_dev_member_3',
    displayName: 'Dev Member 3',
  },
  {
    id: COMMUNITY_WEB_DEV_MEMBER_4_USER_ID,
    authId: 'community_web_dev_member_4',
    username: 'cw_dev_member_4',
    displayName: 'Dev Member 4',
  },
  {
    id: COMMUNITY_WEB_DEV_MEMBER_5_USER_ID,
    authId: 'community_web_dev_member_5',
    username: 'cw_dev_member_5',
    displayName: 'Dev Member 5',
  },
] as const;

export function resolveDevCommunityId(
  envCommunityId: string | undefined,
): string {
  return envCommunityId?.trim() || COMMUNITY_WEB_DEV_COMMUNITY_ID;
}

export function isDevCommunityId(communityId: string): boolean {
  return communityId === COMMUNITY_WEB_DEV_COMMUNITY_ID;
}
