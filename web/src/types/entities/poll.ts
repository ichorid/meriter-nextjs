// Poll entity types
import type { ID, Timestamp } from '../common';

export interface Poll {
  _id: ID;
  data: PollData;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PollData {
  title: string;
  description?: string;
  options: PollOption[];
  expiresAt: Timestamp;
  createdAt: Timestamp;
  totalVotes: number;
  communityId: string;
}

export interface PollOption {
  id: ID;
  text: string;
  votes: number; // total score allocated
  voterCount: number;
}

export interface PollVote {
  optionId: ID;
  amount: number;
  votedAt: Timestamp;
  userId: ID;
}

export interface PollUserVoteSummary {
  voteCount: number;
  totalAmount: number;
  byOption: Record<string, number>; // optionId -> total amount
}

export interface PollCreate {
  title: string;
  description?: string;
  options: Omit<PollOption, 'votes' | 'voterCount'>[];
  expiresAt: Timestamp;
  communityId: string;
}

export interface PollVoteCreate {
  pollId: ID;
  optionId: ID;
  amount: number;
}

export interface PollResult {
  poll: Poll;
  userVote?: PollUserVoteSummary;
  totalVoters: number;
  isExpired: boolean;
  canVote: boolean;
}

