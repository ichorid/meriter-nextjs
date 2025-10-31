// Polls feature types
// DEPRECATED: Poll, PollCast, and PollOption types should be imported from @meriter/shared-types
// Use: import type { Poll, PollCast, PollOption } from '@meriter/shared-types';

// Legacy poll types - kept for backwards compatibility
export interface IPollData {
    title: string;
    description?: string;
    options: IPollOption[];
    expiresAt: Date | string;
    createdAt: Date | string;
    totalCasts: number;
    communityId: string;
}

export interface IPollOption {
    id: string;
    text: string;
    votes: number; // total score allocated
    casterCount: number;
}

export interface IPollCast {
    optionId: string;
    amount: number;
    castAt: Date | string;
}

export interface IPollUserCastSummary {
    castCount: number;
    totalAmount: number;
    byOption: Record<string, number>; // optionId -> total amount
}

// Legacy Poll type - DO NOT USE, use @meriter/shared-types instead
export interface Poll {
    _id: string;
    data: IPollData;
    createdBy: string;
}

