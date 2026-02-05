import { trpc } from '@/lib/trpc/client';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { SubmitTappalkaChoiceInput } from '../types';

/**
 * Hook to submit user's choice in tappalka comparison
 * 
 * Automatically invalidates progress query and publication queries on success
 */
export function useTappalkaChoice() {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  return trpc.tappalka.submitChoice.useMutation({
    onSuccess: async (_result, variables) => {
      // Invalidate progress to update UI
      await utils.tappalka.getProgress.invalidate();
      
      // Invalidate and refetch specific publication queries to update scores
      // Both winner and loser posts are affected (showCost deducted, winReward added to winner)
      await utils.publications.getById.invalidate({ id: variables.winnerPostId });
      await utils.publications.getById.refetch({ id: variables.winnerPostId });
      await utils.publications.getById.invalidate({ id: variables.loserPostId });
      await utils.publications.getById.refetch({ id: variables.loserPostId });
      
      // Invalidate all publications lists to update scores in feeds
      await utils.publications.getAll.invalidate();
      
      // Invalidate infinite queries (used in community feeds) to update scores
      queryClient.invalidateQueries({
        queryKey: queryKeys.publications.all,
        exact: false,
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.publications.all,
        exact: false,
      });
      
      // Also invalidate by community if we have the communityId
      // This ensures community-specific infinite queries are updated
      queryClient.invalidateQueries({
        queryKey: queryKeys.publications.byCommunity(variables.communityId),
        exact: false,
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.publications.byCommunity(variables.communityId),
        exact: false,
      });
    },
  });
}

