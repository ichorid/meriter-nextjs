// Votes React Query hooks
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { votesApiV1 } from '@/lib/api/v1';
import type { CreateVoteRequest } from '@/types/api-v1';
import { walletKeys, type Wallet } from './useWallet';
import { useAuth } from '@/contexts/AuthContext';

// Vote on publication
export function useVoteOnPublication() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ publicationId, data, communityId }: { publicationId: string; data: CreateVoteRequest; communityId?: string }) => 
      votesApiV1.voteOnPublication(publicationId, data),
    onMutate: async (variables) => {
      const { data, communityId } = variables || {};
      const shouldOptimistic = !!user?.id && !!communityId && !!data?.sourceType;
      if (!shouldOptimistic) return {} as any;
      
      const context: any = {};
      
      // Handle quota optimistic update (supports raw quota and simplified { plus, minus } shapes)
      if (data.sourceType === 'quota') {
        const quotaKey = ['quota', user!.id, communityId!];
        await queryClient.cancelQueries({ queryKey: quotaKey });
        const previousQuota = queryClient.getQueryData<any>(quotaKey);
        if (previousQuota) {
          const delta = Math.abs(data.amount || 0);
          let next: any = previousQuota;
          if (typeof previousQuota === 'object') {
            if (Object.prototype.hasOwnProperty.call(previousQuota, 'remainingToday')) {
              next = {
                ...previousQuota,
                usedToday: (previousQuota.usedToday || 0) + delta,
                remainingToday: Math.max(0, (previousQuota.remainingToday || 0) - delta),
              };
            } else if (Object.prototype.hasOwnProperty.call(previousQuota, 'plus')) {
              next = {
                ...previousQuota,
                plus: Math.max(0, (previousQuota.plus || 0) - delta),
              };
            }
          }
          queryClient.setQueryData(quotaKey, next);
        }
        context.quotaKey = quotaKey;
        context.previousQuota = previousQuota;
      }
      
      // Handle wallet optimistic update
      if (data.sourceType === 'personal' && communityId) {
        const walletsKey = walletKeys.wallets();
        const balanceKey = walletKeys.balance(communityId);
        await queryClient.cancelQueries({ queryKey: walletsKey });
        await queryClient.cancelQueries({ queryKey: balanceKey });
        
        // Calculate wallet delta: negative amount means spend (downvote refunds)
        const voteAmount = data.amount || 0;
        const walletDelta = voteAmount > 0 ? -Math.abs(voteAmount) : Math.abs(voteAmount);
        
        // Save previous state
        const previousWallets = queryClient.getQueryData<Wallet[]>(walletsKey);
        const previousBalance = queryClient.getQueryData<number>(balanceKey);
        
        // Update wallets array
        if (previousWallets) {
          queryClient.setQueryData<Wallet[]>(walletsKey, (old) => {
            if (!old) return old;
            return old.map(w => {
              if (w.communityId === communityId) {
                return {
                  ...w,
                  balance: Math.max(0, (w.balance || 0) + walletDelta),
                };
              }
              return w;
            });
          });
        }
        
        // Update balance query
        if (previousBalance !== undefined) {
          queryClient.setQueryData<number>(balanceKey, (old) => {
            if (old === undefined) return old;
            return Math.max(0, old + walletDelta);
          });
        }
        
        context.walletsKey = walletsKey;
        context.balanceKey = balanceKey;
        context.previousWallets = previousWallets;
        context.previousBalance = previousBalance;
      }
      
      return context;
    },
    onSuccess: (result) => {
      // Invalidate publications to update vote counts
      queryClient.invalidateQueries({ queryKey: ['publications'] });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: walletKeys.wallets() });
      queryClient.invalidateQueries({ queryKey: walletKeys.balance() });
      
      // Invalidate quota queries to update remaining quota (for quota votes)
      // Use prefix matching to invalidate all quota queries for all users and communities
      queryClient.invalidateQueries({ queryKey: ['quota'], exact: false });
      
      // If a comment was created, invalidate all comments queries
      // Use prefix matching to catch all comment query keys including ['comments', publicationSlug]
      if (result.comment) {
        queryClient.invalidateQueries({ queryKey: ['comments'], exact: false });
      }
    },
    onError: (error: any, _vars, ctx) => {
      console.error('Vote on publication error:', error);
      if (ctx) {
        if ((ctx as any).quotaKey && (ctx as any).previousQuota) {
          queryClient.setQueryData((ctx as any).quotaKey, (ctx as any).previousQuota);
        }
        if ((ctx as any).previousWallets) {
          queryClient.setQueryData((ctx as any).walletsKey, (ctx as any).previousWallets);
        }
        if ((ctx as any).previousBalance !== undefined) {
          queryClient.setQueryData((ctx as any).balanceKey, (ctx as any).previousBalance);
        }
      }
      // Re-throw to allow component to handle
      throw error;
    },
    onSettled: (_data, _err, vars, ctx) => {
      const communityId = vars?.communityId;
      if (user?.id && communityId) {
        queryClient.invalidateQueries({ queryKey: ['quota', user.id, communityId] });
      }
      if (ctx && (ctx as any).quotaKey) {
        queryClient.invalidateQueries({ queryKey: (ctx as any).quotaKey });
      }
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: walletKeys.wallets() });
        queryClient.invalidateQueries({ queryKey: walletKeys.balance(communityId) });
      }
    },
  });
}

// Vote on comment
export function useVoteOnComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ commentId, data, communityId }: { commentId: string; data: CreateVoteRequest; communityId?: string }) => 
      votesApiV1.voteOnComment(commentId, data),
    onMutate: async (variables) => {
      const { data, communityId } = variables || {};
      const shouldOptimistic = !!user?.id && !!communityId && !!data?.sourceType;
      if (!shouldOptimistic) return {} as any;
      
      const context: any = {};
      
      // Handle quota optimistic update (supports raw quota and simplified { plus, minus } shapes)
      if (data.sourceType === 'quota') {
        const quotaKey = ['quota', user!.id, communityId!];
        await queryClient.cancelQueries({ queryKey: quotaKey });
        const previousQuota = queryClient.getQueryData<any>(quotaKey);
        if (previousQuota) {
          const delta = Math.abs(data.amount || 0);
          let next: any = previousQuota;
          if (typeof previousQuota === 'object') {
            if (Object.prototype.hasOwnProperty.call(previousQuota, 'remainingToday')) {
              next = {
                ...previousQuota,
                usedToday: (previousQuota.usedToday || 0) + delta,
                remainingToday: Math.max(0, (previousQuota.remainingToday || 0) - delta),
              };
            } else if (Object.prototype.hasOwnProperty.call(previousQuota, 'plus')) {
              next = {
                ...previousQuota,
                plus: Math.max(0, (previousQuota.plus || 0) - delta),
              };
            }
          }
          queryClient.setQueryData(quotaKey, next);
        }
        context.quotaKey = quotaKey;
        context.previousQuota = previousQuota;
      }
      
      // Handle wallet optimistic update
      if (data.sourceType === 'personal' && communityId) {
        const walletsKey = walletKeys.wallets();
        const balanceKey = walletKeys.balance(communityId);
        await queryClient.cancelQueries({ queryKey: walletsKey });
        await queryClient.cancelQueries({ queryKey: balanceKey });
        
        // Calculate wallet delta: negative amount means spend (downvote refunds)
        const voteAmount = data.amount || 0;
        const walletDelta = voteAmount > 0 ? -Math.abs(voteAmount) : Math.abs(voteAmount);
        
        // Save previous state
        const previousWallets = queryClient.getQueryData<Wallet[]>(walletsKey);
        const previousBalance = queryClient.getQueryData<number>(balanceKey);
        
        // Update wallets array
        if (previousWallets) {
          queryClient.setQueryData<Wallet[]>(walletsKey, (old) => {
            if (!old) return old;
            return old.map(w => {
              if (w.communityId === communityId) {
                return {
                  ...w,
                  balance: Math.max(0, (w.balance || 0) + walletDelta),
                };
              }
              return w;
            });
          });
        }
        
        // Update balance query
        if (previousBalance !== undefined) {
          queryClient.setQueryData<number>(balanceKey, (old) => {
            if (old === undefined) return old;
            return Math.max(0, old + walletDelta);
          });
        }
        
        context.walletsKey = walletsKey;
        context.balanceKey = balanceKey;
        context.previousWallets = previousWallets;
        context.previousBalance = previousBalance;
      }
      
      return context;
    },
    onSuccess: (result) => {
      // Invalidate all comments queries to update vote counts
      // Use prefix matching to catch all comment query keys including ['comments', publicationSlug]
      queryClient.invalidateQueries({ queryKey: ['comments'], exact: false });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: walletKeys.wallets() });
      queryClient.invalidateQueries({ queryKey: walletKeys.balance() });
      
      // Invalidate quota queries to update remaining quota (for quota votes)
      queryClient.invalidateQueries({ queryKey: ['quota'], exact: false });
    },
    onError: (error, _vars, ctx) => {
      console.error('Vote on comment error:', error);
      if (ctx) {
        if ((ctx as any).quotaKey && (ctx as any).previousQuota) {
          queryClient.setQueryData((ctx as any).quotaKey, (ctx as any).previousQuota);
        }
        if ((ctx as any).previousWallets) {
          queryClient.setQueryData((ctx as any).walletsKey, (ctx as any).previousWallets);
        }
        if ((ctx as any).previousBalance !== undefined) {
          queryClient.setQueryData((ctx as any).balanceKey, (ctx as any).previousBalance);
        }
      }
    },
    onSettled: (_data, _err, vars, ctx) => {
      const communityId = vars?.communityId;
      if (user?.id && communityId) {
        queryClient.invalidateQueries({ queryKey: ['quota', user.id, communityId] });
      }
      if (ctx && (ctx as any).quotaKey) {
        queryClient.invalidateQueries({ queryKey: (ctx as any).quotaKey });
      }
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: walletKeys.wallets() });
        queryClient.invalidateQueries({ queryKey: walletKeys.balance(communityId) });
      }
    },
  });
}

// Remove vote from publication
export function useRemovePublicationVote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (publicationId: string) => votesApiV1.removePublicationVote(publicationId),
    onSuccess: () => {
      // Invalidate publications to update vote counts
      queryClient.invalidateQueries({ queryKey: ['publications'] });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
    onError: (error) => {
      console.error('Remove publication vote error:', error);
    },
  });
}

// Remove vote from comment
export function useRemoveCommentVote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (commentId: string) => votesApiV1.removeCommentVote(commentId),
    onSuccess: () => {
      // Invalidate comments to update vote counts
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
    onError: (error) => {
      console.error('Remove comment vote error:', error);
    },
  });
}

// Vote on publication with optional comment (combined endpoint)
export function useVoteOnPublicationWithComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ 
      publicationId, 
      data, 
      communityId 
    }: { 
      publicationId: string; 
      data: { 
        amount: number; 
        sourceType?: 'personal' | 'quota'; 
        comment?: string; 
      }; 
      communityId?: string; 
    }) => votesApiV1.voteOnPublicationWithComment(publicationId, data),
    onMutate: async (variables) => {
      const { data, communityId } = variables || {};
      const shouldOptimistic = !!user?.id && !!communityId && !!data?.sourceType;
      if (!shouldOptimistic) return {} as any;
      
      const context: any = {};
      
      // Handle quota optimistic update
      if (data.sourceType === 'quota') {
        const quotaKey = ['quota', user!.id, communityId!];
        await queryClient.cancelQueries({ queryKey: quotaKey });
        const previousQuota = queryClient.getQueryData<any>(quotaKey);
        if (previousQuota) {
          const delta = Math.abs(data.amount || 0);
          let next: any = previousQuota;
          if (typeof previousQuota === 'object') {
            if (Object.prototype.hasOwnProperty.call(previousQuota, 'remainingToday')) {
              next = {
                ...previousQuota,
                usedToday: (previousQuota.usedToday || 0) + delta,
                remainingToday: Math.max(0, (previousQuota.remainingToday || 0) - delta),
              };
            } else if (Object.prototype.hasOwnProperty.call(previousQuota, 'plus')) {
              next = {
                ...previousQuota,
                plus: Math.max(0, (previousQuota.plus || 0) - delta),
              };
            }
          }
          queryClient.setQueryData(quotaKey, next);
        }
        context.quotaKey = quotaKey;
        context.previousQuota = previousQuota;
      }
      
      // Handle wallet optimistic update
      if (data.sourceType === 'personal' && communityId) {
        const walletsKey = walletKeys.wallets();
        const balanceKey = walletKeys.balance(communityId);
        await queryClient.cancelQueries({ queryKey: walletsKey });
        await queryClient.cancelQueries({ queryKey: balanceKey });
        
        const voteAmount = data.amount || 0;
        const walletDelta = voteAmount > 0 ? -Math.abs(voteAmount) : Math.abs(voteAmount);
        
        const previousWallets = queryClient.getQueryData<Wallet[]>(walletsKey);
        const previousBalance = queryClient.getQueryData<number>(balanceKey);
        
        if (previousWallets) {
          queryClient.setQueryData<Wallet[]>(walletsKey, (old) => {
            if (!old) return old;
            return old.map(w => {
              if (w.communityId === communityId) {
                return {
                  ...w,
                  balance: Math.max(0, (w.balance || 0) + walletDelta),
                };
              }
              return w;
            });
          });
        }
        
        if (previousBalance !== undefined) {
          queryClient.setQueryData<number>(balanceKey, (old) => {
            if (old === undefined) return old;
            return Math.max(0, old + walletDelta);
          });
        }
        
        context.walletsKey = walletsKey;
        context.balanceKey = balanceKey;
        context.previousWallets = previousWallets;
        context.previousBalance = previousBalance;
      }
      
      return context;
    },
    onSuccess: (result) => {
      // Invalidate publications to update vote counts
      queryClient.invalidateQueries({ queryKey: ['publications'] });
      
      // Invalidate comments to refresh list with new comment
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      
      // If comment was created, invalidate quota queries
      if (result.comment) {
        queryClient.invalidateQueries({ queryKey: ['quota'] });
      }
    },
    onError: (error, variables, context: any) => {
      // Rollback optimistic updates
      if (context?.quotaKey && context?.previousQuota !== undefined) {
        queryClient.setQueryData(context.quotaKey, context.previousQuota);
      }
      
      if (context?.walletsKey && context?.previousWallets !== undefined) {
        queryClient.setQueryData(context.walletsKey, context.previousWallets);
      }
      
      if (context?.balanceKey && context?.previousBalance !== undefined) {
        queryClient.setQueryData(context.balanceKey, context.previousBalance);
      }
      
      console.error('Vote with comment error:', error);
    },
  });
}
