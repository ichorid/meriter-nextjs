// Feed feature types
// Migrated from content/publications/publication.type.ts

export interface IPublicationElement {
    _id?: string;
    type?: string;
    uri: string;
    url?: string;
    proto?: string;
    meta?: object;
    content?: any;
    tags?: string[];
    ts?: number;
}

export interface Publication {
    _id: string;
    slug: string;
    tgChatId: string;
    tgChatName?: string;
    tgMessageId?: number;
    tgAuthorName?: string;
    authorPhotoUrl?: string;
    messageText: string;
    keyword?: string;
    plus: number;
    minus: number;
    sum: number;
    currency?: string;
    inMerits?: number;
    ts: Date;
    elements?: IPublicationElement[];
}

export interface Feed {
    publications: Publication[];
    hasMore: boolean;
    total: number;
}

