// Polls API endpoints
import { apiClient } from '../client';
import type { 
  CreatePollRequest,
  CreatePollResponse,
  VotePollRequest,
  VotePollResponse
} from '@/types/api';
import type { Poll, PollResult } from '@/types/entities';

export const pollsApi = {
  /**
   * Get polls with pagination
   */
  async getPolls(params: { skip?: number; limit?: number } = {}): Promise<Poll[]> {
    const response = await apiClient.get<Poll[]>('/api/rest/polls', { params });
    return response.data;
  },

  /**
   * Get single poll
   */
  async getPoll(id: string): Promise<Poll> {
    const response = await apiClient.get<Poll>(`/api/rest/polls/${id}`);
    return response.data;
  },

  /**
   * Get poll results
   */
  async getPollResults(id: string): Promise<PollResult> {
    const response = await apiClient.get<PollResult>(`/api/rest/polls/${id}/results`);
    return response.data;
  },

  /**
   * Create new poll
   */
  async createPoll(data: CreatePollRequest): Promise<Poll> {
    const response = await apiClient.post<CreatePollResponse>('/api/rest/polls', data);
    return response.data;
  },

  /**
   * Vote on poll
   */
  async votePoll(id: string, data: VotePollRequest): Promise<VotePollResponse['data']> {
    const response = await apiClient.postRaw<VotePollResponse>(`/api/rest/polls/${id}/vote`, data);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Vote failed');
    }
    return response.data.data;
  },

  /**
   * Update poll
   */
  async updatePoll(id: string, data: Partial<CreatePollRequest>): Promise<Poll> {
    const response = await apiClient.put<Poll>(`/api/rest/polls/${id}`, data);
    return response.data;
  },

  /**
   * Delete poll
   */
  async deletePoll(id: string): Promise<void> {
    await apiClient.delete(`/api/rest/polls/${id}`);
  },
};
