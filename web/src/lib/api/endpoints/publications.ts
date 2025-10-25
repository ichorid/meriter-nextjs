// Publications API endpoints with Zod validation
import { apiClient } from '../client';
import { z } from 'zod';
import { 
  PublicationSchema, 
  CreatePublicationDtoSchema,
  Publication,
  CreatePublicationDto,
  ListQueryParams 
} from '@meriter/shared-types';

export const publicationsApi = {
  /**
   * Get publications with pagination and sorting
   */
  async getPublications(params: ListQueryParams = {}): Promise<Publication[]> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.order) queryParams.append('order', params.order);
    if (params.communityId) queryParams.append('communityId', params.communityId);
    if (params.userId) queryParams.append('authorId', params.userId);
    if (params.tag) queryParams.append('hashtag', params.tag);

    const response = await apiClient.get(`/api/v1/publications?${queryParams.toString()}`);
    
    // Validate response with Zod
    return z.array(PublicationSchema).parse(response);
  },

  /**
   * Get user's publications
   */
  async getMyPublications(params: { page?: number; pageSize?: number } = {}): Promise<Publication[]> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());

    const response = await apiClient.get(`/api/v1/publications/my?${queryParams.toString()}`);
    return z.array(PublicationSchema).parse(response);
  },

  /**
   * Get publications by community
   */
  async getPublicationsByCommunity(
    communityId: string, 
    params: ListQueryParams = {}
  ): Promise<Publication[]> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.order) queryParams.append('order', params.order);

    const response = await apiClient.get(`/api/v1/publications?communityId=${communityId}&${queryParams.toString()}`);
    return z.array(PublicationSchema).parse(response);
  },

  /**
   * Get single publication
   */
  async getPublication(id: string): Promise<Publication> {
    const response = await apiClient.get(`/api/v1/publications/${id}`);
    return PublicationSchema.parse(response);
  },

  /**
   * Create new publication
   */
  async createPublication(data: CreatePublicationDto): Promise<Publication> {
    // Validate input data
    const validatedData = CreatePublicationDtoSchema.parse(data);
    
    const response = await apiClient.post('/api/v1/publications', validatedData);
    return PublicationSchema.parse(response);
  },

  /**
   * Update publication
   */
  async updatePublication(id: string, data: Partial<CreatePublicationDto>): Promise<Publication> {
    const response = await apiClient.put(`/api/v1/publications/${id}`, data);
    return PublicationSchema.parse(response);
  },

  /**
   * Delete publication
   */
  async deletePublication(id: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/api/v1/publications/${id}`);
  },
};
