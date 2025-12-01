/**
 * Wallets API Functions using Orval-generated code
 */
import { customInstance } from '@/lib/api/wrappers/mutator';
import type { Wallet } from '@/types/api-v1';

export const walletsApi = {
  getList: async (): Promise<Wallet[]> => {
    return customInstance<Wallet[]>({ url: '/api/v1/wallets', method: 'GET' });
  },
  
  getByCommunity: async (communityId: string): Promise<Wallet> => {
    return customInstance<Wallet>({ url: `/api/v1/wallets/${communityId}`, method: 'GET' });
  },
  
  getBalance: async (communityId: string): Promise<number> => {
    return customInstance<number>({ url: `/api/v1/wallets/${communityId}/balance`, method: 'GET' });
  },
  
  withdraw: async (data: any): Promise<any> => {
    return customInstance({ url: '/api/v1/wallets/withdraw', method: 'POST', data });
  },
  
  transfer: async (data: any): Promise<any> => {
    return customInstance({ url: '/api/v1/wallets/transfer', method: 'POST', data });
  },
  
  getQuota: async (communityId: string): Promise<any> => {
    return customInstance({ url: `/api/v1/wallets/${communityId}/quota`, method: 'GET' });
  },
  
  getFreeBalance: async (communityId: string): Promise<number> => {
    return customInstance<number>({ url: `/api/v1/wallets/${communityId}/free-balance`, method: 'GET' });
  },
  
  getTransactions: async (params?: any): Promise<any> => {
    return customInstance({ url: '/api/v1/wallets/transactions', method: 'GET', params });
  },
  
  getTransactionUpdates: async (): Promise<any> => {
    return customInstance({ url: '/api/v1/wallets/transactions/updates', method: 'GET' });
  },
  
  getAllTransactions: async (params?: any): Promise<any> => {
    return customInstance({ url: '/api/v1/wallets/transactions/all', method: 'GET', params });
  },
};


