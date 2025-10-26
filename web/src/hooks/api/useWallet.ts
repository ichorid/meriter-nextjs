// Wallet React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletApiV1 } from '@/lib/api/v1';

// Local type definitions
interface Wallet {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  currencyOfCommunityTgChatId?: string;
  amount?: number;
}

interface Transaction {
  id: string;
  userId: string;
  communityId: string;
  amount: number;
  type: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface WithdrawRequest {
  communityId: string;
  amount: number;
  memo?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  skip: number;
  limit: number;
}

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
    queryFn: () => walletApiV1.getWallets(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    initialData: [],
  });
}

// Get wallet balance
export function useWalletBalance(currencyOfCommunityTgChatId?: string) {
  return useQuery({
    queryKey: walletKeys.balance(currencyOfCommunityTgChatId),
    queryFn: () => walletApiV1.getBalance(currencyOfCommunityTgChatId!),
    staleTime: 1 * 60 * 1000, // 1 minute
    enabled: !!currencyOfCommunityTgChatId,
  });
}

// Get free balance for voting
export function useFreeBalance(currencyOfCommunityTgChatId?: string) {
  return useQuery({
    queryKey: walletKeys.freeBalance(currencyOfCommunityTgChatId),
    queryFn: () => walletApiV1.getFreeBalance(currencyOfCommunityTgChatId!),
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!currencyOfCommunityTgChatId,
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
    queryFn: () => walletApiV1.getTransactions(params),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Get transaction updates
export function useTransactionUpdates() {
  return useQuery({
    queryKey: walletKeys.updates(),
    queryFn: () => walletApiV1.getTransactionUpdates(),
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
    queryFn: () => walletApiV1.getAllTransactions(params),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Create transaction (vote/comment) - TODO: Implement proper transaction creation
// export function useCreateTransaction() {
//   const queryClient = useQueryClient();
//   
//   return useMutation({
//     mutationFn: (data: {
//       amountPoints: number;
//       comment?: string;
//       directionPlus: boolean;
//       forTransactionId?: string;
//       forPublicationSlug?: string;
//       inPublicationSlug?: string;
//       publicationSlug?: string;
//     }) => walletApiV1.createTransaction(data),
//     onSuccess: (newTransaction) => {
//       // Invalidate wallet-related queries
//       queryClient.invalidateQueries({ queryKey: walletKeys.wallets() });
//       queryClient.invalidateQueries({ queryKey: walletKeys.balance() });
//       queryClient.invalidateQueries({ queryKey: walletKeys.freeBalance() });
//       queryClient.invalidateQueries({ queryKey: walletKeys.transactions() });
//       queryClient.invalidateQueries({ queryKey: walletKeys.myTransactions({}) });
//       queryClient.invalidateQueries({ queryKey: walletKeys.updates() });
//       
//       // Also invalidate comments and publications since transactions affect them
//       queryClient.invalidateQueries({ queryKey: ['comments'] });
//       queryClient.invalidateQueries({ queryKey: ['publications'] });
//     },
//     onError: (error) => {
//       console.error('Create transaction error:', error);
//     },
//   });
// }

// Withdraw funds
export function useWithdraw() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: WithdrawRequest) => walletApiV1.withdraw(data.communityId, data),
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
    }) => walletApiV1.transfer(data.currencyOfCommunityTgChatId, data),
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
