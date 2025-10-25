export interface Resource {
    id: string;
    slug?: string;
    externalIds?: {
        telegram?: string;
    };
}
export interface User {
    id: string;
    externalIds: {
        telegram: string;
    };
    username?: string;
    firstName?: string;
    lastName?: string;
    displayName: string;
    avatarUrl?: string;
    profile: {
        bio?: string;
        location?: string;
        website?: string;
        isVerified?: boolean;
    };
    createdAt: string;
    updatedAt: string;
}
export interface Community {
    id: string;
    externalIds: {
        telegram: string;
    };
    name: string;
    description?: string;
    avatarUrl?: string;
    administrators: string[];
    members: string[];
    settings: {
        iconUrl?: string;
        currencyNames: {
            singular: string;
            plural: string;
            genitive: string;
        };
        dailyEmission: number;
    };
    isAdmin?: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface Publication {
    id: string;
    communityId: string;
    authorId: string;
    beneficiaryId?: string;
    content: string;
    type: 'text' | 'image' | 'video' | 'poll';
    metadata?: {
        imageUrl?: string;
        videoUrl?: string;
        pollData?: PollData;
        tags?: string[];
    };
    metrics: {
        upvotes: number;
        downvotes: number;
        score: number;
        commentCount: number;
    };
    createdAt: string;
    updatedAt: string;
}
export interface Comment {
    id: string;
    targetType: 'publication' | 'comment';
    targetId: string;
    authorId: string;
    content: string;
    metrics: {
        upvotes: number;
        downvotes: number;
        score: number;
        replyCount: number;
    };
    createdAt: string;
    updatedAt: string;
}
export interface Vote {
    id: string;
    targetType: 'publication' | 'comment';
    targetId: string;
    userId: string;
    amount: number;
    sourceType: 'personal' | 'quota';
    commentId?: string;
    createdAt: string;
}
export interface Poll {
    id: string;
    communityId: string;
    authorId: string;
    question: string;
    description?: string;
    options: PollOption[];
    expiresAt: string;
    isActive: boolean;
    metrics: {
        totalVotes: number;
        voterCount: number;
        totalAmount: number;
    };
    createdAt: string;
    updatedAt: string;
}
export interface PollOption {
    id: string;
    text: string;
    votes: number;
    voterCount: number;
}
export interface PollData {
    title: string;
    description?: string;
    options: PollOption[];
    expiresAt: string;
    createdAt: string;
    totalVotes: number;
    communityId: string;
}
export interface PollVote {
    id: string;
    pollId: string;
    optionId: string;
    userId: string;
    amount: number;
    createdAt: string;
}
export interface Wallet {
    id: string;
    userId: string;
    communityId: string;
    balance: number;
    currency: {
        singular: string;
        plural: string;
        genitive: string;
    };
    lastUpdated: string;
}
export interface Transaction {
    id: string;
    userId: string;
    communityId: string;
    type: 'vote' | 'comment' | 'poll_vote' | 'withdrawal' | 'transfer';
    amount: number;
    description?: string;
    metadata?: {
        targetType?: 'publication' | 'comment' | 'poll';
        targetId?: string;
        sourceType?: 'personal' | 'daily_quota';
    };
    createdAt: string;
}
export interface CreatePublicationDto {
    communityId: string;
    content: string;
    type: 'text' | 'image' | 'video';
    beneficiaryId?: string;
    metadata?: {
        imageUrl?: string;
        videoUrl?: string;
        tags?: string[];
    };
}
export interface CreateCommentDto {
    targetType: 'publication' | 'comment';
    targetId: string;
    content: string;
}
export interface CreateVoteDto {
    targetType: 'publication' | 'comment';
    targetId: string;
    amount: number;
    sourceType: 'personal' | 'quota';
    comment?: {
        content: string;
    };
}
export interface CreatePollDto {
    communityId: string;
    question: string;
    description?: string;
    options: Array<{
        text: string;
    }>;
    expiresAt: string;
}
export interface CreatePollVoteDto {
    pollId: string;
    optionId: string;
    amount: number;
}
export interface UpdateCommunityDto {
    name?: string;
    description?: string;
    settings?: {
        iconUrl?: string;
        currencyNames?: {
            singular?: string;
            plural?: string;
            genitive?: string;
        };
        dailyEmission?: number;
    };
}
export interface ApiResponse<T> {
    data: T;
    meta: {
        timestamp: string;
        requestId: string;
        pagination?: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    };
}
export interface ApiErrorResponse {
    error: {
        code: string;
        message: string;
        details?: any;
    };
    meta: {
        timestamp: string;
        requestId: string;
    };
}
export type SortOption = 'score' | 'recent' | 'controversial';
export type SortOrder = 'asc' | 'desc';
export interface PaginationParams {
    page?: number;
    pageSize?: number;
}
export interface SortParams {
    sort?: SortOption;
    order?: SortOrder;
}
export interface FilterParams {
    tag?: string;
    communityId?: string;
    userId?: string;
}
export interface ListQueryParams extends PaginationParams, SortParams, FilterParams {
}
export * from './index';
//# sourceMappingURL=index.d.ts.map