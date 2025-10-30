// Auth feature types
// NOTE: User type is now imported from @meriter/shared-types
// This file only contains auth-specific types not in shared-types

export interface Session {
    user: import('@meriter/shared-types').User;
    token: string;
    expiresAt: Date;
}

export interface AuthToken {
    jwt: string;
    expiresAt: Date;
}

