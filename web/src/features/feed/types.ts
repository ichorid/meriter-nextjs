// Feed feature types
// Migrated from content/publications/publication.type.ts

export interface PublicationAuthor {
    id: string;
    name: string;
    photoUrl?: string;
    username?: string;
}

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

