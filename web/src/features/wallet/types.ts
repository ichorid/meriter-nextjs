// Wallet feature types

export interface Wallet {
    tgUserId: string;
    amount: number;
    currencyOfCommunityTgChatId: string;
    currencyNames: Record<number, string>;
}

export interface Transaction {
    _id: string;
    transactionId: string;
    tgUserId: string;
    amount: number;
    fromTgChatId?: string;
    currencyOfCommunityTgChatId: string;
    publicationSlug?: string;
    timestamp: Date;
    type: 'merit' | 'comment' | 'withdraw' | 'transfer';
}

export interface Currency {
    communityId: string;
    names: Record<number, string>; // Plural forms for different numbers
    icon?: string;
}

