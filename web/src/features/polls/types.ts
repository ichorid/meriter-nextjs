// Polls feature types
// Frontend-specific poll types for component interfaces
// For domain types, use: import type { Poll, PollCast, PollOption } from '@meriter/shared-types';

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

