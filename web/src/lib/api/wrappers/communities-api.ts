/**
 * Communities API Functions using Orval-generated code
 */
import {
  communitiesControllerGetCommunities,
  communitiesControllerGetCommunity,
  communitiesControllerDeleteCommunity,
} from '@/lib/api/generated/communities/communities';
import type { CommunitiesControllerGetCommunitiesParams } from '@/lib/api/generated/meriterAPI.schemas';
import { customInstance } from '@/lib/api/wrappers/mutator';
import type { Community, PaginatedResponse } from '@/types/api-v1';

export const communitiesApi = {
  getList: async (params?: { skip?: number; limit?: number }): Promise<Community[]> => {
    const generatedParams: CommunitiesControllerGetCommunitiesParams = {
      skip: params?.skip?.toString(),
      limit: params?.limit?.toString(),
    };
    return communitiesControllerGetCommunities(generatedParams) as Promise<Community[]>;
  },
  
  getById: async (id: string): Promise<Community> => {
    return communitiesControllerGetCommunity(id) as Promise<Community>;
  },
  
  create: async (data: any): Promise<Community> => {
    return customInstance<Community>({ url: '/api/v1/communities', method: 'POST', data });
  },
  
  update: async (id: string, data: any): Promise<Community> => {
    return customInstance<Community>({ url: `/api/v1/communities/${id}`, method: 'PUT', data });
  },
  
  delete: async (id: string): Promise<void> => {
    return communitiesControllerDeleteCommunity(id) as Promise<void>;
  },
  
  getPublications: async (id: string, params: any): Promise<PaginatedResponse<any>> => {
    return customInstance({ 
      url: `/api/v1/communities/${id}/publications`, 
      method: 'GET',
      params 
    });
  },
};


