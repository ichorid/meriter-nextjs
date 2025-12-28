/**
 * Application route constants
 */

export const routes = {
    // Auth
    login: "/meriter/login",
    logout: "/meriter/logout",

    // Main
    home: "/meriter/home", // Deprecated - use profile instead
    profile: "/meriter/profile",
    userProfile: (userId: string) => `/meriter/users/${userId}`,
    settings: "/meriter/settings",
    notifications: "/meriter/notifications",
    about: "/meriter/about",

    // Communities
    communities: "/meriter/communities",
    community: (id: string) => `/meriter/communities/${id}`,
    communityMembers: (id: string) => `/meriter/communities/${id}/members`,
    communityDeleted: (id: string) => `/meriter/communities/${id}/deleted`,
    communitySettings: (id: string) => `/meriter/communities/${id}/settings`,
    setupCommunity: "/meriter/setup-community",

    // Publications
    publication: (id: string) => `/meriter/publications/${id}`,

    // Polls
    polls: "/meriter/polls",
    poll: (id: string) => `/meriter/polls/${id}`,

    // Wallet
    wallet: "/meriter/wallet",
    transactions: "/meriter/wallet/transactions",
} as const;
