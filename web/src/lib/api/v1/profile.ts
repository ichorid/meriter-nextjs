import { apiClient } from '../client';
import type { User, UserCommunityRole, Publication, Community } from '@/types/api-v1';
import type { PaginatedResponse } from '@/types/api-v1';

// Extended types for API responses with community names
export interface UserCommunityRoleWithName extends UserCommunityRole {
  communityName?: string;
}

export interface PublicationWithCommunityName extends Publication {
  communityName?: string;
}

export interface MeritStat {
  communityId: string;
  communityName: string;
  amount: number;
}

export interface MeritStatsResponse {
  meritStats: MeritStat[];
}

export interface UpdateProfileData {
  bio?: string | null;
  location?: { region: string; city: string } | null;
  website?: string | null;
  values?: string | null;
  about?: string | null;
  contacts?: { email: string; messenger: string } | null;
  educationalInstitution?: string | null;
}

export const profileApiV1 = {
  async getUserRoles(userId: string): Promise<UserCommunityRoleWithName[]> {
    const response = await apiClient.get<{ success: true; data: UserCommunityRoleWithName[] }>(
      `/api/v1/users/${userId}/roles`
    );
    return response.data;
  },

  async getUserProjects(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<PublicationWithCommunityName>> {
    const response = await apiClient.get<PaginatedResponse<PublicationWithCommunityName>>(
      `/api/v1/users/${userId}/projects?page=${page}&limit=${limit}`
    );
    return response;
  },

  async getLeadCommunities(userId: string): Promise<Community[]> {
    const response = await apiClient.get<{ success: true; data: Community[] }>(
      `/api/v1/users/${userId}/lead-communities`
    );
    return response.data;
  },

  async updateProfile(data: UpdateProfileData): Promise<User> {
    const response = await apiClient.put<User>(
      `/api/v1/users/me/profile`,
      data
    );
    return response;
  },

  async getMeritStats(): Promise<MeritStatsResponse> {
    const response = await apiClient.get<MeritStatsResponse>(
      `/api/v1/users/me/merit-stats`
    );
    return response;
  },
};

