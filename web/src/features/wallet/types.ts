// Wallet feature types
// DEPRECATED: Wallet and Transaction types should be imported from @meriter/shared-types
// Use: import type { Wallet, Transaction } from '@meriter/shared-types';

// Legacy Wallet type - DO NOT USE, use @meriter/shared-types instead
export interface Wallet {
    userId: string; // Internal ID
    amount: number;
    communityId: string; // Internal ID
    currencyNames: Record<number, string>;
}

// Legacy Transaction type - DO NOT USE, use @meriter/shared-types instead
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

