// Wallet feature types

export interface Wallet {
    userId: string; // Internal ID
    amount: number;
    communityId: string; // Internal ID
    currencyNames: Record<number, string>;
}

export interface Transaction {
    _id: string;
    transactionId: string;
    userId: string; // Internal ID
    amount: number;
    fromCommunityId?: string; // Internal ID
    communityId: string; // Internal ID
    publicationSlug?: string;
    timestamp: Date;
    type: 'merit' | 'comment' | 'withdraw' | 'transfer';
}

export interface Currency {
    communityId: string;
    names: Record<number, string>; // Plural forms for different numbers
    icon?: string;
}

