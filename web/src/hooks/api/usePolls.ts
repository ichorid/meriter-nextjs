// Polls React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pollsApiV1 } from '@/lib/api/v1';
import { walletKeys } from './useWallet';
import { useAuth } from '@/contexts/AuthContext';
import { updateWalletOptimistically, rollbackOptimisticUpdates, type OptimisticUpdateContext } from './useVotes.helpers';

// Local type definitions
interface Poll {
  id: string;
  title: string;
  description?: string;
  options: PollOption[];
  communityId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  _id?: string;
}

interface PollOption {
  id: string;
  text: string;
  votes: number;
  percentage: number;
}

interface PollCreate {
  question: string;
  description?: string;
  options: { id?: string; text: string }[];
  communityId: string;
  expiresAt: string;
}

interface PollResult {
  poll: Poll;
  userCast?: PollCast;
  totalCasts: number;
}

interface PollCast {
  id: string;
  pollId: string;
  optionId: string;
  userId: string;
  amount: number;
  createdAt: string;
}

interface CastPollRequest {
  optionId: string;
  amount: number;
}

// Query keys
export const pollsKeys = {
  all: ['polls'] as const,
  lists: () => [...pollsKeys.all, 'list'] as const,
  list: (params: { skip?: number; limit?: number; userId?: string }) => [...pollsKeys.lists(), params] as const,
  details: () => [...pollsKeys.all, 'detail'] as const,
  detail: (id: string) => [...pollsKeys.details(), id] as const,
  results: (id: string) => [...pollsKeys.all, 'results', id] as const,
} as const;

// Get polls with pagination
export function usePolls(params: { skip?: number; limit?: number; userId?: string } = {}) {
  return useQuery({
    queryKey: pollsKeys.list(params),
    queryFn: () => pollsApiV1.getPolls(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get single poll
export function usePoll(id: string) {
  return useQuery({
    queryKey: pollsKeys.detail(id),
    queryFn: () => pollsApiV1.getPoll(id),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!id,
  });
}

// Get poll results
export function usePollResults(id: string) {
  return useQuery({
    queryKey: pollsKeys.results(id),
    queryFn: () => pollsApiV1.getPollResults(id),
    staleTime: 1 * 60 * 1000, // 1 minute
    enabled: !!id,
  });
}

// Create poll
export function useCreatePoll() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: PollCreate) => pollsApiV1.createPoll(data),
    onSuccess: (newPoll) => {
      // Invalidate and refetch polls lists
      queryClient.invalidateQueries({ queryKey: pollsKeys.lists() });
      
      // Add the new poll to cache
      queryClient.setQueryData(pollsKeys.detail(newPoll.id), newPoll);
    },
    onError: (error) => {
      console.error('Create poll error:', error);
    },
  });
}

// Cast poll
export function useCastPoll() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ id, data, communityId }: { id: string; data: CastPollRequest; communityId?: string }) => 
      pollsApiV1.castPoll(id, data),
    onMutate: async (variables) => {
      const { data, communityId } = variables || {};
      const shouldOptimistic = !!user?.id && !!communityId;
      if (!shouldOptimistic) return {} as OptimisticUpdateContext;
      
      const context: OptimisticUpdateContext = {};
      
      // Handle wallet optimistic update (poll casts always use personal wallet)
      if (communityId) {
        const walletUpdate = await updateWalletOptimistically(
          queryClient,
          communityId,
          Math.abs(data.amount || 0), // Pass positive amount - helper will convert to negative delta for spending
          walletKeys
        );
        if (walletUpdate) {
          context.walletsKey = walletUpdate.walletsKey;
          context.balanceKey = walletUpdate.balanceKey;
          context.previousWallets = walletUpdate.previousWallets;
          context.previousBalance = walletUpdate.previousBalance;
        }
      }
      
      return context;
    },
    onSuccess: (result, { id }) => {
      // Invalidate poll results to get updated cast counts
      queryClient.invalidateQueries({ queryKey: pollsKeys.results(id) });
      
      // Invalidate polls list to ensure consistency
      queryClient.invalidateQueries({ queryKey: pollsKeys.lists() });
      
      // Invalidate the specific poll to refetch with updated data
      queryClient.invalidateQueries({ queryKey: pollsKeys.detail(id) });
      
      // Invalidate wallet queries to ensure balance is up to date
      queryClient.invalidateQueries({ queryKey: walletKeys.wallets() });
      queryClient.invalidateQueries({ queryKey: walletKeys.balance() });
    },
    onError: (error, variables, context) => {
      console.error('Cast poll error:', error);
      rollbackOptimisticUpdates(queryClient, context);
    },
    onSettled: (_data, _err, vars, ctx) => {
      const communityId = vars?.communityId;
      if (communityId) {
        queryClient.invalidateQueries({ queryKey: walletKeys.wallets() });
        queryClient.invalidateQueries({ queryKey: walletKeys.balance(communityId) });
      }
    },
  });
}

// Update poll
export function useUpdatePoll() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PollCreate> }) => 
      pollsApiV1.updatePoll(id, data),
    onSuccess: (updatedPoll) => {
      // Update the poll in cache
      queryClient.setQueryData(pollsKeys.detail(updatedPoll.id), updatedPoll);
      
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: pollsKeys.lists() });
    },
    onError: (error) => {
      console.error('Update poll error:', error);
    },
  });
}

// Delete poll
export function useDeletePoll() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => pollsApiV1.deletePoll(id),
    onSuccess: (_, deletedId) => {
      // Remove from all caches
      queryClient.removeQueries({ queryKey: pollsKeys.detail(deletedId) });
      queryClient.removeQueries({ queryKey: pollsKeys.results(deletedId) });
      queryClient.invalidateQueries({ queryKey: pollsKeys.lists() });
    },
    onError: (error) => {
      console.error('Delete poll error:', error);
    },
  });
}
