// Wallet API endpoints
import { apiClient } from '../client';
import type { 
  GetWalletsResponse,
  GetTransactionsResponse,
  WithdrawResponse
} from '@/types/api';
import type { Wallet, Transaction, WithdrawRequest } from '@/types/entities';
import type { PaginatedResponse } from '@/types/common';

export const walletApi = {
  /**
   * Get user wallets
   */
  async getWallets(): Promise<Wallet[]> {
    const response = await apiClient.get<GetWalletsResponse>('/api/rest/wallet');
    return response.data;
  },

  /**
   * Get wallet balance
   */
  async getBalance(currencyOfCommunityTgChatId?: string): Promise<number> {
    const params = currencyOfCommunityTgChatId ? { currencyOfCommunityTgChatId } : {};
    const response = await apiClient.get<number>('/api/rest/wallet', { params });
    return response;
  },

  /**
   * Get user transactions
   */
  async getTransactions(params: { 
    skip?: number; 
    limit?: number; 
    positive?: boolean;
    userId?: string;
  } = {}): Promise<PaginatedResponse<Transaction>> {
    const response = await apiClient.get<GetTransactionsResponse>('/api/rest/transactions/my', { params });
    return response.data;
  },

  /**
   * Get transaction updates
   */
  async getTransactionUpdates(): Promise<Transaction[]> {
    const response = await apiClient.get<{ success: true; data: Transaction[] }>('/api/rest/transactions/updates');
    return response.data;
  },

  /**
   * Get all transactions
   */
  async getAllTransactions(params: { 
    skip?: number; 
    limit?: number;
    userId?: string;
    communityId?: string;
  } = {}): Promise<PaginatedResponse<Transaction>> {
    const response = await apiClient.get<GetTransactionsResponse>('/api/rest/transactions', { params });
    return response.data;
  },

  /**
   * Create transaction (vote/comment)
   */
  async createTransaction(data: {
    amountPoints: number;
    comment?: string;
    directionPlus: boolean;
    forTransactionId?: string;
    forPublicationSlug?: string;
    inPublicationSlug?: string;
    publicationSlug?: string;
  }): Promise<Transaction> {
    const response = await apiClient.post<{ success: true; data: Transaction }>('/api/rest/transactions', data);
    return response.data;
  },

  /**
   * Withdraw funds
   */
  async withdraw(data: WithdrawRequest): Promise<WithdrawResponse['data']> {
    const response = await apiClient.postRaw<WithdrawResponse>('/api/rest/wallet/withdraw', data);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Withdrawal failed');
    }
    return response.data.data;
  },

  /**
   * Transfer funds
   */
  async transfer(data: {
    amount: number;
    toUserId: string;
    currencyOfCommunityTgChatId: string;
    description?: string;
  }): Promise<Transaction> {
    const response = await apiClient.post<Transaction>('/api/rest/wallet/transfer', data);
    return response;
  },

  /**
   * Get free balance for voting
   */
  async getFreeBalance(currencyOfCommunityTgChatId?: string): Promise<number> {
    const params = currencyOfCommunityTgChatId ? { currencyOfCommunityTgChatId } : {};
    const response = await apiClient.get<number>('/api/rest/free', { params });
    return response;
  },
};
