/**
 * Votes API Functions using Orval-generated code
 */
import { customInstance } from '@/lib/api/wrappers/mutator';
import type { Vote } from '@/types/api-v1';

export const votesApi = {
  getList: async (params?: any): Promise<Vote[]> => {
    return customInstance<Vote[]>({ url: '/api/v1/votes', method: 'GET', params });
  },
  
  getById: async (id: string): Promise<Vote> => {
    return customInstance<Vote>({ url: `/api/v1/votes/${id}`, method: 'GET' });
  },
  
  create: async (data: any): Promise<Vote> => {
    return customInstance<Vote>({ url: '/api/v1/votes', method: 'POST', data });
  },
  
  voteOnPublication: async (id: string, data: any): Promise<any> => {
    return customInstance({ url: `/api/v1/publications/${id}/vote`, method: 'POST', data });
  },
  
  voteOnComment: async (id: string, data: any): Promise<any> => {
    return customInstance({ url: `/api/v1/comments/${id}/vote`, method: 'POST', data });
  },
  
  voteOnPublication: async (id: string, data: any): Promise<any> => {
    return customInstance({ url: `/api/v1/publications/${id}/vote`, method: 'POST', data });
  },
  
  voteOnVote: async (id: string, data: any): Promise<any> => {
    return customInstance({ url: `/api/v1/votes/${id}/vote`, method: 'POST', data });
  },
};


