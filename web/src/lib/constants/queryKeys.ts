/**
 * Query Keys Factory for React Query
 * Centralizes all query keys for type safety and consistency
 */

// Inline serialization to avoid circular dependencies
function serializeValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map(serializeValue).join(',')}]`;
    }

    if (typeof value === 'object') {
        const sortedKeys = Object.keys(value).sort();
        const pairs = sortedKeys
            .map(key => `${key}:${serializeValue((value as Record<string, unknown>)[key])}`)
            .join(',');
        return `{${pairs}}`;
    }

    return String(value);
}

function serializeQueryParams(params: Record<string, any> | undefined | null): string {
    if (!params || Object.keys(params).length === 0) {
        return '';
    }

    return serializeValue(params);
}

export const queryKeys = {
    // Auth
    auth: {
        all: ["auth"] as const,
        me: () => ["auth", "me"] as const,
    },

    // Users
    users: {
        all: ["users"] as const,
        profile: (userId: string) =>
            ["users", "profile", userId] as const,
        updatesFrequency: () =>
            ["users", "updates-frequency"] as const,
        updates: (userId: string, params?: Record<string, any>) =>
            [
                "users",
                "updates",
                userId,
                serializeQueryParams(params || {}),
            ] as const,
    },

    // Publications
    publications: {
        all: ["publications"] as const,
        lists: () => ["publications", "list"] as const,
        list: (params: Record<string, any>) =>
            [
                "publications",
                "list",
                serializeQueryParams(params),
            ] as const,
        details: () => ["publications", "detail"] as const,
        detail: (id: string) =>
            ["publications", "detail", id] as const,
        my: () => ["publications", "my"] as const,
        myPublications: (params: Record<string, any>) =>
            [
                "publications",
                "my",
                serializeQueryParams(params),
            ] as const,
        byCommunity: (communityId: string) =>
            ["publications", "community", communityId] as const,
        byCommunityInfinite: (
            communityId: string,
            params: { pageSize?: number; sort?: string; order?: string } = {}
        ) =>
            [
                "publications",
                "community",
                communityId,
                "infinite",
                serializeQueryParams(params),
            ] as const,
    },

    // Comments
    comments: {
        all: ["comments"] as const,
        lists: () => ["comments", "list"] as const,
        list: (params: Record<string, any>) =>
            ["comments", "list", serializeQueryParams(params)] as const,
        details: () => ["comments", "detail"] as const,
        detail: (id: string) => ["comments", "detail", id] as const,
        detailData: (id: string) =>
            ["comments", "detail", id, "details"] as const,
        byPublication: (publicationId: string) =>
            ["comments", "publication", publicationId] as const,
        byComment: (commentId: string) =>
            ["comments", "comment", commentId] as const,
        my: (userId: string) =>
            ["comments", "my", userId] as const,
        myComments: (userId: string, params: Record<string, any>) =>
            [
                "comments",
                "my",
                userId,
                serializeQueryParams(params),
            ] as const,
    },

    // Communities
    communities: {
        all: ["communities"] as const,
        lists: () => ["communities", "list"] as const,
        list: (params: Record<string, any>) =>
            [
                "communities",
                "list",
                serializeQueryParams(params),
            ] as const,
        details: () => ["communities", "detail"] as const,
        detail: (id: string) =>
            ["communities", "detail", id] as const,
        feed: (
            communityId: string,
            params: { pageSize?: number; sort?: string; tag?: string } = {}
        ) =>
            [
                "communities",
                "detail",
                communityId,
                "feed",
                serializeQueryParams(params),
            ] as const,
    },

    // Polls
    polls: {
        all: ["polls"] as const,
        lists: () => ["polls", "list"] as const,
        list: (params: Record<string, any>) =>
            ["polls", "list", serializeQueryParams(params)] as const,
        details: () => ["polls", "detail"] as const,
        detail: (id: string) => ["polls", "detail", id] as const,
    },

    // Wallet
    wallet: {
        all: ["wallet"] as const,
        wallets: () => ["wallet", "wallets"] as const,
        wallet: (communityId?: string) =>
            ["wallet", "wallet", communityId] as const,
        balance: (communityId?: string) =>
            ["wallet", "balance", communityId] as const,
        freeBalance: (communityId?: string) =>
            ["wallet", "freeBalance", communityId] as const,
        transactions: () => ["wallet", "transactions"] as const,
        transactionsList: (params: Record<string, any>) =>
            [
                "wallet",
                "transactions",
                serializeQueryParams(params),
            ] as const,
        myTransactions: (params: Record<string, any>) =>
            [
                "wallet",
                "myTransactions",
                serializeQueryParams(params),
            ] as const,
        updates: () => ["wallet", "updates"] as const,
    },

    // Settings
    settings: {
        all: ["settings"] as const,
        updatesFrequency: () =>
            ["settings", "updates-frequency"] as const,
    },

    // Search
    search: {
        all: ["search"] as const,
        query: (params: Record<string, any>) =>
            ["search", serializeQueryParams(params)] as const,
    },

    // Notifications
    notifications: {
        all: ["notifications"] as const,
        lists: () => ["notifications", "list"] as const,
        list: (params: Record<string, any>) =>
            [
                "notifications",
                "list",
                serializeQueryParams(params),
            ] as const,
        unreadCount: () =>
            ["notifications", "unread-count"] as const,
        preferences: () =>
            ["notifications", "preferences"] as const,
    },

    // Version
    version: () => ["version"] as const,

    // Config
    config: {
        all: ["config"] as const,
        runtime: () => ["config", "runtime"] as const,
        getConfig: () => ["config", "getConfig"] as const,
    },
};
