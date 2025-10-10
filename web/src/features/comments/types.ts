// Comments feature types

export interface Comment {
    _id: string;
    transactionId: string;
    publicationSlug: string;
    text: string;
    tgUserId: string;
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

export interface Vote {
    commentId: string;
    userId: string;
    value: number; // positive or negative
    timestamp: Date;
}

