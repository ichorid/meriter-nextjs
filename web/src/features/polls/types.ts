// Polls feature types
// From content/publications/publication.type.ts

export interface IPollData {
    title: string;
    description?: string;
    options: IPollOption[];
    expiresAt: Date | string;
    createdAt: Date | string;
    totalVotes: number;
    communityId: string;
}

export interface IPollOption {
    id: string;
    text: string;
    votes: number; // total score allocated
    voterCount: number;
}

export interface IPollVote {
    optionId: string;
    amount: number;
    votedAt: Date | string;
}

export interface IPollUserVoteSummary {
    voteCount: number;
    totalAmount: number;
    byOption: Record<string, number>; // optionId -> total amount
}

export interface Poll {
    _id: string;
    data: IPollData;
    createdBy: string;
}

