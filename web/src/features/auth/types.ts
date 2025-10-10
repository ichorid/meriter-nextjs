// Auth feature types

export interface User {
    id: string;
    tgUserId?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    photoUrl?: string;
}

export interface Session {
    user: User;
    token: string;
    expiresAt: Date;
}

export interface AuthToken {
    jwt: string;
    expiresAt: Date;
}

