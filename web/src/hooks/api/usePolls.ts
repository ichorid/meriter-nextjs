// Polls React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pollsApi } from '@/lib/api';
import type { Poll, PollCreate, PollResult } from '@/types/entities';
import type { VotePollRequest } from '@/types/api-v1';

// Query keys
export const pollsKeys = {
  all: ['polls'] as const,
  lists: () => [...pollsKeys.all, 'list'] as const,
  list: (params: { skip?: number; limit?: number }) => [...pollsKeys.lists(), params] as const,
  details: () => [...pollsKeys.all, 'detail'] as const,
  detail: (id: string) => [...pollsKeys.details(), id] as const,
  results: (id: string) => [...pollsKeys.all, 'results', id] as const,
} as const;

// Get polls with pagination
export function usePolls(params: { skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: pollsKeys.list(params),
    queryFn: () => pollsApi.getPolls(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get single poll
export function usePoll(id: string) {
  return useQuery({
    queryKey: pollsKeys.detail(id),
    queryFn: () => pollsApi.getPoll(id),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!id,
  });
}

// Get poll results
export function usePollResults(id: string) {
  return useQuery({
    queryKey: pollsKeys.results(id),
    queryFn: () => pollsApi.getPollResults(id),
    staleTime: 1 * 60 * 1000, // 1 minute
    enabled: !!id,
  });
}

// Create poll
export function useCreatePoll() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: PollCreate) => pollsApi.createPoll(data),
    onSuccess: (newPoll) => {
      // Invalidate and refetch polls lists
      queryClient.invalidateQueries({ queryKey: pollsKeys.lists() });
      
      // Add the new poll to cache
      queryClient.setQueryData(pollsKeys.detail(newPoll._id), newPoll);
    },
    onError: (error) => {
      console.error('Create poll error:', error);
    },
  });
}

// Vote on poll
export function useVotePoll() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VotePollRequest }) => 
      pollsApi.votePoll(id, data),
    onSuccess: (result, { id }) => {
      // Update poll cache with new vote data
      queryClient.setQueryData(pollsKeys.detail(id), result.poll);
      
      // Invalidate poll results to get updated vote counts
      queryClient.invalidateQueries({ queryKey: pollsKeys.results(id) });
      
      // Invalidate polls list to ensure consistency
      queryClient.invalidateQueries({ queryKey: pollsKeys.lists() });
    },
    onError: (error) => {
      console.error('Vote poll error:', error);
    },
  });
}

// Update poll
export function useUpdatePoll() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PollCreate> }) => 
      pollsApi.updatePoll(id, data),
    onSuccess: (updatedPoll) => {
      // Update the poll in cache
      queryClient.setQueryData(pollsKeys.detail(updatedPoll._id), updatedPoll);
      
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
    mutationFn: (id: string) => pollsApi.deletePoll(id),
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
