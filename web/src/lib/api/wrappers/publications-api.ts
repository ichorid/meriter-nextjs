/**
 * Publications API Functions
 * 
 * This file provides a clean API interface using Orval-generated hooks.
 * 
 * Uses generated hooks from @/lib/api/generated/publications/publications
 */

import {
  publicationsControllerGetPublications,
  publicationsControllerGetPublication,
  publicationsControllerCreatePublication,
  publicationsControllerDeletePublication,
} from '@/lib/api/generated/publications/publications';
import type { PublicationsControllerGetPublicationsParams } from '@/lib/api/generated/meriterAPI.schemas';
import { customInstance } from '@/lib/api/wrappers/mutator';
import type {
  Publication,
  CreatePublicationDto,
  PaginatedResponse,
} from '@/types/api-v1';

export interface GetPublicationsParams {
  skip?: number;
  limit?: number;
  type?: string;
  communityId?: string;
  userId?: string;
  tag?: string;
  sort?: string;
  order?: string;
}

export interface GetPublicationsByCommunityParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: string;
}

/**
 * Publications API interface
 * This will be replaced with generated hooks after Orval generation
 */
export const publicationsApi = {
  /**
   * Get list of publications
   * Uses generated API client function
   */
  getList: async (params: GetPublicationsParams): Promise<Publication[]> => {
    const generatedParams: PublicationsControllerGetPublicationsParams = {
      communityId: params.communityId,
      authorId: params.userId,
      hashtag: params.tag,
      skip: params.skip?.toString(),
      limit: params.limit?.toString(),
    };
    return publicationsControllerGetPublications(generatedParams) as Promise<Publication[]>;
  },

  /**
   * Get single publication by ID
   * Uses generated API client function
   */
  getById: async (id: string): Promise<Publication> => {
    const { publicationsControllerGetPublication } = await import('@/lib/api/generated/publications/publications');
    return publicationsControllerGetPublication(id) as Promise<Publication>;
  },

  /**
   * Get my publications
   * TODO: Replace with useGetPublications hook (with authorId param)
   */
  getMy: async (params: {
    skip?: number;
    limit?: number;
    userId?: string;
  }): Promise<Publication[]> => {
    const generatedParams: PublicationsControllerGetPublicationsParams = {
      authorId: params.userId,
      skip: params.skip?.toString(),
      limit: params.limit?.toString(),
    };
    return publicationsControllerGetPublications(generatedParams) as Promise<Publication[]>;
  },

  /**
   * Get publications by community
   * TODO: Replace with useGetCommunitiesIdPublications hook
   */
  getByCommunity: async (
    communityId: string,
    params: GetPublicationsByCommunityParams
  ): Promise<PaginatedResponse<Publication>> => {
    return customInstance<PaginatedResponse<Publication>>({ 
      url: `/api/v1/communities/${communityId}/publications`, 
      method: 'GET',
      params: {
        page: params.page?.toString(),
        pageSize: params.pageSize?.toString(),
        sort: params.sort,
        order: params.order,
      }
    });
  },

  /**
   * Create publication
   * Uses generated API client function
   */
  create: async (data: CreatePublicationDto): Promise<Publication> => {
    return customInstance<Publication>({
      url: '/api/v1/publications',
      method: 'POST',
      data,
    });
  },

  /**
   * Update publication
   * TODO: Replace with useUpdatePublicationsId mutation
   */
  update: async (
    id: string,
    data: Partial<CreatePublicationDto>
  ): Promise<Publication> => {
    return customInstance<Publication>({
      url: `/api/v1/publications/${id}`,
      method: 'PUT',
      data,
    });
  },

  /**
   * Delete publication
   * Uses generated API client function
   */
  delete: async (id: string): Promise<void> => {
    const { publicationsControllerDeletePublication } = await import('@/lib/api/generated/publications/publications');
    return publicationsControllerDeletePublication(id) as Promise<void>;
  },
};

