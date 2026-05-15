import { trpc } from '@/lib/trpc/client';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/constants/queryKeys';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import {
  invalidateFutureVisionsList,
  refetchCommunityFeed,
} from '@/hooks/api/invalidate-community-session-caches';

/**
 * Hook to submit user's choice in tappalka comparison
 *
 * Progress is invalidated immediately; feed/publication cache updates are deferred
 * so the next pair can render without waiting on heavy refetches.
 */
export function useTappalkaChoice() {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  return trpc.tappalka.submitChoice.useMutation({
    onSuccess: (_result, variables) => {
      void utils.tappalka.getProgress.invalidate({ communityId: variables.communityId });

      const communityId = variables.communityId;
      const winnerPostId = variables.winnerPostId;
      const loserPostId = variables.loserPostId;

      window.setTimeout(() => {
        void (async () => {
          await utils.publications.getById.invalidate({ id: winnerPostId });
          await utils.publications.getById.invalidate({ id: loserPostId });
          await utils.publications.getAll.invalidate();

          queryClient.invalidateQueries({
            queryKey: queryKeys.publications.all,
            exact: false,
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.publications.byCommunity(communityId),
            exact: false,
          });

          if (communityId) {
            await refetchCommunityFeed(utils, communityId);
          }

          await invalidateFutureVisionsList(utils);
          await utils.wallets.getBalance.invalidate({ communityId: GLOBAL_COMMUNITY_ID });
          queryClient.invalidateQueries({ queryKey: ['quota'], exact: false });
        })();
      }, 0);
    },
  });
}
