// Feed feature types
// DEPRECATED: Publication type should be imported from @meriter/shared-types
// Use: import type { Publication } from '@meriter/shared-types';

// Legacy types kept for backwards compatibility
export interface PublicationAuthor {
    id: string;
    name: string;
    photoUrl?: string;
    username?: string;
}

// Legacy Publication type - DO NOT USE, use @meriter/shared-types instead
export interface Publication {
    _id: string;
    slug: string;
    tgChatId: string;
    tgChatName?: string;
    tgMessageId?: number;
    tgAuthorName?: string;
    tgAuthorId?: string;
    authorPhotoUrl?: string;
    beneficiaryName?: string;
    beneficiaryPhotoUrl?: string;
    beneficiaryId?: string;
    beneficiaryUsername?: string;
    messageText: string;
    keyword?: string;
    plus: number;
    minus: number;
    sum: number;
    currency?: string;
    inMerits?: number;
    ts: Date;
}

export interface Feed {
    publications: Publication[];
    hasMore: boolean;
    total: number;
}

