/**
 * @deprecated Profile API - kept for backward compatibility
 * Migrate to use generated APIs from @/lib/api/generated/*-api.ts
 */

import { customInstance } from '@/lib/api/wrappers/mutator';

// Types
export type UserCommunityRoleWithName = any;
export type PublicationWithCommunityName = any;
export type UpdateProfileData = any;
export type MeritStatsResponse = any;

export const profileApiV1 = {
  getProfile: async (userId: string): Promise<any> => {
    return customInstance({ url: `/api/v1/users/${userId}/profile`, method: 'GET' });
  },
  
  updateProfile: async (userId: string, data: any): Promise<any> => {
    return customInstance({ url: `/api/v1/users/${userId}/profile`, method: 'PUT', data });
  },
  
  getMeritStats: async (userId: string): Promise<any> => {
    return customInstance({ url: `/api/v1/users/${userId}/merit-stats`, method: 'GET' });
  },
};

