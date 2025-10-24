// Wallet React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletApi } from '@/lib/api';
import type { Wallet, Transaction, WithdrawRequest } from '@/types/entities';
import type { PaginatedResponse } from '@/types/common';

// Query keys
export const walletKeys = {
  all: ['wallet'] as const,
  wallets: () => [...walletKeys.all, 'wallets'] as const,
  balance: (currencyOfCommunityTgChatId?: string) => 
    [...walletKeys.all, 'balance', currencyOfCommunityTgChatId] as const,
  transactions: () => [...walletKeys.all, 'transactions'] as const,
  transactionsList: (params: any) => [...walletKeys.transactions(), params] as const,
  myTransactions: (params: any) => [...walletKeys.all, 'myTransactions', params] as const,
  updates: () => [...walletKeys.all, 'updates'] as const,
  freeBalance: (currencyOfCommunityTgChatId?: string) => 
    [...walletKeys.all, 'freeBalance', currencyOfCommunityTgChatId] as const,
} as const;

// Get user wallets
export function useWallets() {
  return useQuery({
    queryKey: walletKeys.wallets(),
    queryFn: () => walletApi.getWallets(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get wallet balance
export function useWalletBalance(currencyOfCommunityTgChatId?: string) {
  return useQuery({
    queryKey: walletKeys.balance(currencyOfCommunityTgChatId),
    queryFn: () => walletApi.getBalance(currencyOfCommunityTgChatId),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Get free balance for voting
export function useFreeBalance(currencyOfCommunityTgChatId?: string) {
  return useQuery({
    queryKey: walletKeys.freeBalance(currencyOfCommunityTgChatId),
    queryFn: () => walletApi.getFreeBalance(currencyOfCommunityTgChatId),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Get user transactions
export function useMyTransactions(params: { 
  skip?: number; 
  limit?: number; 
  positive?: boolean;
} = {}) {
  return useQuery({
    queryKey: walletKeys.myTransactions(params),
    queryFn: () => walletApi.getTransactions(params),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Get transaction updates
export function useTransactionUpdates() {
  return useQuery({
    queryKey: walletKeys.updates(),
    queryFn: () => walletApi.getTransactionUpdates(),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Get all transactions
export function useTransactions(params: { 
  skip?: number; 
  limit?: number;
  userId?: string;
  communityId?: string;
} = {}) {
  return useQuery({
    queryKey: walletKeys.transactionsList(params),
    queryFn: () => walletApi.getAllTransactions(params),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Create transaction (vote/comment)
export function useCreateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      amountPoints: number;
      comment?: string;
      directionPlus: boolean;
      forTransactionId?: string;
      forPublicationSlug?: string;
      inPublicationSlug?: string;
      publicationSlug?: string;
    }) => walletApi.createTransaction(data),
    onSuccess: (newTransaction) => {
      // Invalidate wallet-related queries
      queryClient.invalidateQueries({ queryKey: walletKeys.wallets() });
      queryClient.invalidateQueries({ queryKey: walletKeys.balance() });
      queryClient.invalidateQueries({ queryKey: walletKeys.freeBalance() });
      queryClient.invalidateQueries({ queryKey: walletKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: walletKeys.myTransactions({}) });
      queryClient.invalidateQueries({ queryKey: walletKeys.updates() });
      
      // Also invalidate comments and publications since transactions affect them
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['publications'] });
    },
    onError: (error) => {
      console.error('Create transaction error:', error);
    },
  });
}

// Withdraw funds
export function useWithdraw() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: WithdrawRequest) => walletApi.withdraw(data),
    onSuccess: (result) => {
      // Invalidate wallet-related queries
      queryClient.invalidateQueries({ queryKey: walletKeys.wallets() });
      queryClient.invalidateQueries({ queryKey: walletKeys.balance() });
      queryClient.invalidateQueries({ queryKey: walletKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: walletKeys.myTransactions({}) });
    },
    onError: (error) => {
      console.error('Withdraw error:', error);
    },
  });
}

// Transfer funds
export function useTransfer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      amount: number;
      toUserId: string;
      currencyOfCommunityTgChatId: string;
      description?: string;
    }) => walletApi.transfer(data),
    onSuccess: () => {
      // Invalidate wallet-related queries
      queryClient.invalidateQueries({ queryKey: walletKeys.wallets() });
      queryClient.invalidateQueries({ queryKey: walletKeys.balance() });
      queryClient.invalidateQueries({ queryKey: walletKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: walletKeys.myTransactions({}) });
    },
    onError: (error) => {
      console.error('Transfer error:', error);
    },
  });
}
