/**
 * Users API Functions using Orval-generated code
 */
import { customInstance } from '@/lib/api/wrappers/mutator';
import type { User, PaginatedResponse, Comment } from '@/types/api-v1';

export const usersApi = {
  getById: async (id: string): Promise<User> => {
    return customInstance<User>({ url: `/api/v1/users/${id}`, method: 'GET' });
  },
  
  getProfile: async (id: string): Promise<any> => {
    return customInstance({ url: `/api/v1/users/${id}/profile`, method: 'GET' });
  },
  
  getComments: async (userId: string, params?: any): Promise<PaginatedResponse<Comment>> => {
    return customInstance<PaginatedResponse<Comment>>({ 
      url: `/api/v1/users/${userId}/comments`, 
      method: 'GET',
      params 
    });
  },
  
  update: async (id: string, data: any): Promise<User> => {
    return customInstance<User>({ url: `/api/v1/users/${id}`, method: 'PUT', data });
  },
  
  getUserQuota: async (userId: string, communityId: string): Promise<any> => {
    return customInstance({ url: `/api/v1/users/${userId}/quota/${communityId}`, method: 'GET' });
  },
  
  getUpdatesFrequency: async (): Promise<any> => {
    return customInstance({ url: '/api/v1/users/updates-frequency', method: 'GET' });
  },
  
  setUpdatesFrequency: async (frequency: string): Promise<any> => {
    return customInstance({ url: '/api/v1/users/updates-frequency', method: 'PUT', data: { frequency } });
  },
  
  getUpdates: async (userId: string, params?: any): Promise<any> => {
    return customInstance({ url: `/api/v1/users/${userId}/updates`, method: 'GET', params });
  },
};


