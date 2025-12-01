/**
 * Teams API Functions using Orval-generated code
 */
import { customInstance } from '@/lib/api/wrappers/mutator';
import type { Team } from '@/types/api-v1';

export const teamsApi = {
  getList: async (): Promise<Team[]> => {
    return customInstance<Team[]>({ url: '/api/v1/teams', method: 'GET' });
  },
  
  getById: async (id: string): Promise<Team> => {
    return customInstance<Team>({ url: `/api/v1/teams/${id}`, method: 'GET' });
  },
  
  create: async (data: any): Promise<Team> => {
    return customInstance<Team>({ url: '/api/v1/teams', method: 'POST', data });
  },
  
  update: async (id: string, data: any): Promise<Team> => {
    return customInstance<Team>({ url: `/api/v1/teams/${id}`, method: 'PUT', data });
  },
  
  delete: async (id: string): Promise<void> => {
    return customInstance<void>({ url: `/api/v1/teams/${id}`, method: 'DELETE' });
  },
};


