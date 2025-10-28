// Polls React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pollsApiV1 } from '@/lib/api/v1';

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
  userVote?: PollVote;
  totalVotes: number;
}

interface PollVote {
  id: string;
  pollId: string;
  optionId: string;
  userId: string;
  amount: number;
  createdAt: string;
}

interface VotePollRequest {
  optionId: string;
  amount: number;
}

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

// Vote on poll
export function useVotePoll() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VotePollRequest }) => 
      pollsApiV1.voteOnPoll(id, data),
    onSuccess: (result, { id }) => {
      // Invalidate poll results to get updated vote counts
      queryClient.invalidateQueries({ queryKey: pollsKeys.results(id) });
      
      // Invalidate polls list to ensure consistency
      queryClient.invalidateQueries({ queryKey: pollsKeys.lists() });
      
      // Invalidate the specific poll to refetch with updated data
      queryClient.invalidateQueries({ queryKey: pollsKeys.detail(id) });
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
