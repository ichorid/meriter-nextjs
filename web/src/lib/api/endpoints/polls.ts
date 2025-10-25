// Polls API endpoints
import { apiClient } from '../client';
import type { 
  CreatePollRequest,
  CreatePollResponse,
  VotePollRequest,
  VotePollResponse
} from '@/types/api-v1';
import type { Poll, PollResult } from '@/types/entities';

export const pollsApi = {
  /**
   * Get polls with pagination
   */
  async getPolls(params: { skip?: number; limit?: number } = {}): Promise<Poll[]> {
    const response = await apiClient.get<Poll[]>('/api/v1/polls', { params });
    return response;
  },

  /**
   * Get single poll
   */
  async getPoll(id: string): Promise<Poll> {
    const response = await apiClient.get<Poll>(`/api/v1/polls/${id}`);
    return response;
  },

  /**
   * Get poll results
   */
  async getPollResults(id: string): Promise<PollResult> {
    const response = await apiClient.get<PollResult>(`/api/v1/polls/${id}/results`);
    return response;
  },

  /**
   * Create new poll
   */
  async createPoll(data: CreatePollRequest): Promise<Poll> {
    const response = await apiClient.post<Poll>('/api/v1/polls', data);
    return response;
  },

  /**
   * Vote on poll
   */
  async votePoll(id: string, data: VotePollRequest): Promise<VotePollResponse['data']> {
    const response = await apiClient.post<VotePollResponse['data']>(`/api/v1/polls/${id}/votes`, data);
    return response;
  },

  /**
   * Update poll
   */
  async updatePoll(id: string, data: Partial<CreatePollRequest>): Promise<Poll> {
    const response = await apiClient.put<Poll>(`/api/v1/polls/${id}`, data);
    return response;
  },

  /**
   * Delete poll
   */
  async deletePoll(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/polls/${id}`);
  },
};
