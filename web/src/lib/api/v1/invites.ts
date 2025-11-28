import { apiClient } from '../client';
import type { Invite } from '@/types/api-v1';

export const invitesApiV1 = {
  async getInvites(): Promise<Invite[]> {
    const response = await apiClient.get<{ success: true; data: Invite[] }>('/api/v1/invites');
    return response.data;
  },

  async getInviteByCode(code: string): Promise<Invite> {
    const response = await apiClient.get<{ success: true; data: Invite }>(`/api/v1/invites/${code}`);
    return response.data;
  },

  async createInvite(data: {
    targetUserId: string;
    type: 'superadmin-to-lead' | 'lead-to-participant';
    communityId: string;
    teamId?: string;
    expiresAt?: string;
  }): Promise<Invite> {
    const response = await apiClient.post<{ success: true; data: Invite }>('/api/v1/invites', data);
    return response.data;
  },

  async useInvite(code: string): Promise<{ invite: Invite; message: string }> {
    const response = await apiClient.post<{ success: true; data: { invite: Invite; message: string } }>(`/api/v1/invites/${code}/use`);
    return response.data;
  },

  async deleteInvite(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/invites/${id}`);
  },
};

