/**
 * @deprecated This file is kept temporarily for backward compatibility.
 * All code should migrate to use generated API wrappers from @/lib/api/generated/*-api.ts
 * 
 * This file will be removed once all components are migrated.
 */

// Re-export generated APIs for backward compatibility
export { publicationsApi as publicationsApiV1 } from '@/lib/api/wrappers/publications-api';
export { commentsApi as commentsApiV1 } from '@/lib/api/wrappers/comments-api';
export { communitiesApi as communitiesApiV1 } from '@/lib/api/wrappers/communities-api';
export { pollsApi as pollsApiV1 } from '@/lib/api/wrappers/polls-api';
export { votesApi as votesApiV1 } from '@/lib/api/wrappers/votes-api';
export { walletsApi as walletsApiV1, walletsApi as walletApiV1 } from '@/lib/api/wrappers/wallets-api';
export { authApi as authApiV1 } from '@/lib/api/wrappers/auth-api';
export { usersApi as usersApiV1 } from '@/lib/api/wrappers/users-api';
export { teamsApi as teamsApiV1 } from '@/lib/api/wrappers/teams-api';
export { invitesApi as invitesApiV1 } from '@/lib/api/wrappers/invites-api';
export { searchApi as searchApiV1 } from '@/lib/api/wrappers/search-api';
export { notificationsApi as notificationsApiV1 } from '@/lib/api/wrappers/notifications-api';

// Enhanced APIs - use customInstance directly
import { customInstance } from '@/lib/api/wrappers/mutator';

export const communitiesApiV1Enhanced = {
  syncCommunities: () => customInstance({ url: '/api/v1/communities/sync', method: 'POST' }),
};

// Profile API - placeholder for backward compatibility
export const profileApiV1 = {
  // This is a placeholder - actual implementation should use generated APIs
};

