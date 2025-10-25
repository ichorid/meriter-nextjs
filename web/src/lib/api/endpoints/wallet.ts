// Wallet API endpoints
import { apiClient } from '../client';
import type { 
  GetWalletsResponse,
  GetTransactionsResponse,
  WithdrawResponse
} from '@/types/api-v1';
import type { Wallet, Transaction, WithdrawRequest, TransferRequest } from '@/types/entities';
import type { PaginatedResponse } from '@/types/common';

export const walletApi = {
  /**
   * Get user wallets
   */
  async getWallets(): Promise<Wallet[]> {
    const response = await apiClient.get<Wallet[]>('/api/v1/users/me/wallets');
    return response;
  },

  /**
   * Get wallet balance for specific community
   */
  async getBalance(communityId: string): Promise<number> {
    const response = await apiClient.get<Wallet>(`/api/v1/users/me/wallets/${communityId}`);
    return response.balance;
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
    const response = await apiClient.get<PaginatedResponse<Transaction>>('/api/v1/users/me/transactions', { params });
    return response;
  },

  /**
   * Get transaction updates
   */
  async getTransactionUpdates(): Promise<Transaction[]> {
    const response = await apiClient.get<PaginatedResponse<Transaction>>('/api/v1/users/me/transactions', { 
      params: { updates: true } 
    });
    return response.data;
  },

  /**
   * Get all transactions (admin view)
   */
  async getAllTransactions(params: { 
    skip?: number; 
    limit?: number;
    userId?: string;
    communityId?: string;
  } = {}): Promise<PaginatedResponse<Transaction>> {
    const response = await apiClient.get<PaginatedResponse<Transaction>>('/api/v1/users/me/transactions', { params });
    return response;
  },

  /**
   * Withdraw funds
   */
  async withdraw(communityId: string, data: WithdrawRequest): Promise<Transaction> {
    const response = await apiClient.post<Transaction>(`/api/v1/users/me/wallets/${communityId}/withdraw`, data);
    return response;
  },

  /**
   * Transfer funds
   */
  async transfer(communityId: string, data: TransferRequest): Promise<Transaction> {
    const response = await apiClient.post<Transaction>(`/api/v1/users/me/wallets/${communityId}/transfer`, data);
    return response;
  },

  /**
   * Get free balance for voting
   */
  async getFreeBalance(communityId: string): Promise<number> {
    const response = await apiClient.get<number>(`/api/v1/users/me/quota?communityId=${communityId}`);
    return response;
  },
};
