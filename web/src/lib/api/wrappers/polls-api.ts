/**
 * Polls API Functions using Orval-generated code
 */
import { customInstance } from '@/lib/api/wrappers/mutator';
import type { Poll, CreatePollDto, PaginatedResponse } from '@/types/api-v1';

export const pollsApi = {
  getList: async (params?: any): Promise<Poll[]> => {
    const { pollsControllerGetPolls } = await import('@/lib/api/generated/polls/polls');
    return pollsControllerGetPolls(params) as Promise<Poll[]>;
  },
  
  getById: async (id: string): Promise<Poll> => {
    const { pollsControllerGetPoll } = await import('@/lib/api/generated/polls/polls');
    return pollsControllerGetPoll(id) as Promise<Poll>;
  },
  
  create: async (data: CreatePollDto): Promise<Poll> => {
    return customInstance<Poll>({ url: '/api/v1/polls', method: 'POST', data });
  },
  
  delete: async (id: string): Promise<void> => {
    return customInstance<void>({ url: `/api/v1/polls/${id}`, method: 'DELETE' });
  },
  
  cast: async (id: string, data: any): Promise<any> => {
    return customInstance({ url: `/api/v1/polls/${id}/casts`, method: 'POST', data });
  },
  
  getResults: async (id: string): Promise<any> => {
    return customInstance({ url: `/api/v1/polls/${id}/results`, method: 'GET' });
  },
  
  update: async (id: string, data: any): Promise<Poll> => {
    return customInstance<Poll>({ url: `/api/v1/polls/${id}`, method: 'PUT', data });
  },
};

