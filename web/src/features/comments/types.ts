// Comments feature types
// DEPRECATED: Comment and Vote types should be imported from @meriter/shared-types
// These legacy types are kept temporarily for backwards compatibility but should be removed
// Use: import type { Comment, Vote } from '@meriter/shared-types';

// Legacy Comment type - DO NOT USE, use @meriter/shared-types instead
export interface Comment {
    _id: string;
    transactionId: string;
    publicationSlug: string;
    text: string;
    userId: string;
    tgUsername?: string;
    authorPhotoUrl?: string;
    plus: number;
    minus: number;
    sum: number;
    rating?: number;
    timestamp: Date;
    currency?: string;
    inMerits?: number;
}

// Legacy Vote type - DO NOT USE, use @meriter/shared-types instead
export interface Vote {
    commentId: string;
    userId: string;
    value: number; // positive or negative
    timestamp: Date;
}

