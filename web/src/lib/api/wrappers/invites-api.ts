/**
 * Invites API Functions using Orval-generated code
 */
import { customInstance } from '@/lib/api/wrappers/mutator';
import type { Invite } from '@/types/api-v1';

export const invitesApi = {
  getList: async (): Promise<Invite[]> => {
    return customInstance<Invite[]>({ url: '/api/v1/invites', method: 'GET' });
  },
  
  getById: async (id: string): Promise<Invite> => {
    return customInstance<Invite>({ url: `/api/v1/invites/${id}`, method: 'GET' });
  },
  
  create: async (data: any): Promise<Invite> => {
    return customInstance<Invite>({ url: '/api/v1/invites', method: 'POST', data });
  },
  
  accept: async (id: string): Promise<any> => {
    return customInstance({ url: `/api/v1/invites/${id}/accept`, method: 'POST' });
  },
  
  delete: async (id: string): Promise<void> => {
    return customInstance<void>({ url: `/api/v1/invites/${id}`, method: 'DELETE' });
  },
};


