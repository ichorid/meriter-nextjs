// Poll card data hook - fetches poll-specific data when rendering poll cards
import { useMemo } from 'react';
import { usePoll, usePollResults } from './api/usePolls';

interface PollCardData {
  pollData: any;
  userVote: any;
  userVoteSummary: any;
}

export function usePollCardData(pollId: string | undefined) {
  const { data: poll } = usePoll(pollId || '');
  const { data: pollResults } = usePollResults(pollId || '');

  return useMemo((): PollCardData => {
    if (!poll) {
      return {
        pollData: null,
        userVote: undefined,
        userVoteSummary: undefined,
      };
    }

    // Transform poll to match PollVoting component interface
    const pollData = {
      title: poll.question,
      description: poll.description,
      options: poll.options.map((opt: any) => ({
        id: opt.id,
        text: opt.text,
        votes: opt.votes || 0,
      })),
      expiresAt: poll.expiresAt,
      totalVotes: poll.metrics?.totalVotes || 0,
      communityId: poll.communityId,
    };

    // Extract user vote summary from pollResults if available
    // Note: pollResults structure may vary - adjust based on actual API response
    const userVoteSummary = pollResults?.userVoteSummary || undefined;
    const userVote = pollResults?.userVote || undefined;

    return {
      pollData,
      userVote,
      userVoteSummary,
    };
  }, [poll, pollResults]);
}

