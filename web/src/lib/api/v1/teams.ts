import { apiClient } from '../client';
import type { Team } from '@/types/api-v1';

export const teamsApiV1 = {
  async getTeams(): Promise<Team[]> {
    const response = await apiClient.get<{ success: true; data: Team[] }>('/api/v1/teams');
    return response.data;
  },

  async getTeam(id: string): Promise<Team> {
    const response = await apiClient.get<{ success: true; data: Team }>(`/api/v1/teams/${id}`);
    return response.data;
  },

  async createTeam(data: {
    name: string;
    communityId: string;
    school?: string;
    metadata?: Record<string, any>;
  }): Promise<Team> {
    const response = await apiClient.post<{ success: true; data: Team }>('/api/v1/teams', data);
    return response.data;
  },

  async updateTeam(id: string, data: {
    name?: string;
    school?: string;
    metadata?: Record<string, any>;
  }): Promise<Team> {
    const response = await apiClient.put<{ success: true; data: Team }>(`/api/v1/teams/${id}`, data);
    return response.data;
  },

  async deleteTeam(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/teams/${id}`);
  },

  async getTeamParticipants(id: string): Promise<{ participants: string[] }> {
    const response = await apiClient.get<{ success: true; data: { participants: string[] } }>(`/api/v1/teams/${id}/participants`);
    return response.data;
  },

  async removeParticipant(teamId: string, userId: string): Promise<Team> {
    const response = await apiClient.delete<{ success: true; data: Team }>(`/api/v1/teams/${teamId}/participants/${userId}`);
    return response.data;
  },
};

