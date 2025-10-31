// Poll card data hook - fetches poll-specific data when rendering poll cards
import { useMemo } from 'react';
import { usePoll, usePollResults } from './api/usePolls';

interface PollCardData {
  pollData: any;
  userCast: any;
  userCastSummary: any;
}

export function usePollCardData(pollId: string | undefined) {
  const { data: poll } = usePoll(pollId || '');
  const { data: pollResults } = usePollResults(pollId || '');

  return useMemo((): PollCardData => {
    if (!poll) {
      return {
        pollData: null,
        userCast: undefined,
        userCastSummary: undefined,
      };
    }

    // Transform poll to match PollCasting component interface
    const pollData = {
      title: poll.question,
      description: poll.description,
      options: poll.options.map((opt: any) => ({
        id: opt.id,
        text: opt.text,
        votes: opt.votes || 0,
      })),
      expiresAt: poll.expiresAt,
      totalCasts: poll.metrics?.totalCasts || 0,
      communityId: poll.communityId,
    };

    // Extract user cast summary from pollResults if available
    // Note: pollResults structure may vary - adjust based on actual API response
    const userCastSummary = pollResults?.userCastSummary || undefined;
    const userCast = pollResults?.userCast || undefined;

    return {
      pollData,
      userCast,
      userCastSummary,
    };
  }, [poll, pollResults]);
}

