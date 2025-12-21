// New v1 API client with improved types and structure
import { apiClient } from "../client";
import {
    buildQueryString,
    convertPaginationToSkipLimit,
    mergeQueryParams,
} from "@/lib/utils/query-params";
import { validateApiResponse, validatePaginatedResponse } from "../validation";
import { handleAuthResponse } from "./endpoint-helpers";
import {
    UserSchema,
    CommunitySchema,
    PublicationSchema,
    CommentSchema,
    PollSchema,
    CreatePublicationDtoSchema,
    CreateCommentDtoSchema,
    CreateVoteDtoSchema,
    CreatePollDtoSchema,
    CreatePollCastDtoSchema,
    UpdateCommunityDtoSchema,
} from "@/types/api-v1/schemas";
import type {
    User,
    Community,
    Publication,
    Comment,
    Vote,
    Poll,
    PollCast,
    Wallet,
    Transaction,
    CreatePublicationDto,
    CreateCommentDto,
    CreateVoteRequest,
    CreatePollDto,
    CreatePollCastDto,
    UpdateCommunityDto,
    UpdatePublicationDto,
    UpdatePollDto,
} from "@/types/api-v1";
import type { PaginatedResponse } from "@/types/api-v1";
import type {
    AuthResult,
    CommunityMember,
    LeaderboardEntry,
    PollCastResult,
} from "@/types/api-responses";
import type { UpdateEvent } from "@/types/updates";
import {
    VoteWithCommentDto,
    VoteWithCommentDtoSchema,
    WithdrawAmountDtoSchema,
} from "@meriter/shared-types";

// Auth API with enhanced response handling
export const authApiV1 = {
    async getMe(): Promise<User> {
        const response = await apiClient.get<{ success: true; data: User }>(
            "/api/v1/auth/me"
        );
        return response.data;
    },

    async logout(): Promise<void> {
        await apiClient.post("/api/v1/auth/logout");
    },

    async clearCookies(): Promise<void> {
        await apiClient.post("/api/v1/auth/clear-cookies");
    },

    async authenticateFakeUser(): Promise<AuthResult> {
        const response = await apiClient.postRaw<{
            success: boolean;
            data: AuthResult;
            error?: string;
        }>("/api/v1/auth/fake", {});
        return handleAuthResponse<AuthResult>(response);
    },

    async authenticateFakeSuperadmin(): Promise<AuthResult> {
        const response = await apiClient.postRaw<{
            success: boolean;
            data: AuthResult;
            error?: string;
        }>("/api/v1/auth/fake/superadmin", {});
        return handleAuthResponse<AuthResult>(response);
    },
};

// Users API
export const usersApiV1 = {
    async getUser(userId: string): Promise<User> {
        const response = await apiClient.get<{ success: true; data: User }>(
            `/api/v1/users/${userId}`
        );
        return response.data;
    },

    async getMe(): Promise<User> {
        const response = await apiClient.get<{ success: true; data: User }>(
            "/api/v1/users/me"
        );
        return response.data;
    },

    async getUserProfile(userId: string): Promise<User> {
        const response = await apiClient.get<{ success: true; data: User }>(
            `/api/v1/users/${userId}/profile`
        );
        return response.data;
    },

    async getUserCommunities(userId: string): Promise<Community[]> {
        const response = await apiClient.get<{
            success: true;
            data: Community[];
        }>(`/api/v1/users/${userId}/communities`);
        return response.data;
    },

    async getUserManagedCommunities(userId: string): Promise<Community[]> {
        const response = await apiClient.get<{
            success: true;
            data: Community[];
        }>(`/api/v1/users/${userId}/managed-communities`);
        return response.data;
    },

    async getUserPublications(
        userId: string,
        params: { skip?: number; limit?: number } = {}
    ): Promise<PaginatedResponse<Publication>> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<Publication>;
        }>(`/api/v1/users/${userId}/publications`, { params });
        return response.data;
    },

    async getUserComments(
        userId: string,
        params: { skip?: number; limit?: number } = {}
    ): Promise<PaginatedResponse<Comment>> {
        const response = await apiClient.get<{ success?: boolean; data?: any }>(
            `/api/v1/comments/users/${userId}`,
            { params }
        );
        // Handle both response formats: wrapped { success: true, data: {...} } and direct { data: [...], total: ... }
        if (
            response.data &&
            typeof response.data === "object" &&
            "data" in response.data &&
            Array.isArray(response.data.data)
        ) {
            // Direct format from backend
            const backendData = response.data as any;
            return {
                data: backendData.data || [],
                meta: {
                    pagination: {
                        page: backendData.skip
                            ? Math.floor(
                                  backendData.skip / (backendData.limit || 10)
                              ) + 1
                            : 1,
                        pageSize: backendData.limit || 10,
                        total: backendData.total || 0,
                        totalPages: backendData.limit
                            ? Math.ceil(
                                  (backendData.total || 0) / backendData.limit
                              )
                            : 1,
                        hasNext:
                            backendData.skip !== undefined &&
                            backendData.limit !== undefined &&
                            backendData.skip + backendData.limit <
                                (backendData.total || 0),
                        hasPrev:
                            backendData.skip !== undefined &&
                            backendData.skip > 0,
                    },
                    timestamp: new Date().toISOString(),
                    requestId: "",
                },
            };
        }
        // Wrapped format
        return response.data as PaginatedResponse<Comment>;
    },

    async getUserWallets(userId: string): Promise<Wallet[]> {
        const response = await apiClient.get<{ success: true; data: Wallet[] }>(
            `/api/v1/users/${userId}/wallets`
        );
        return response.data;
    },

    async getUserWallet(userId: string, communityId: string): Promise<Wallet> {
        const response = await apiClient.get<{ success: true; data: Wallet }>(
            `/api/v1/users/${userId}/wallets/${communityId}`
        );
        return response.data;
    },

    async getUserTransactions(
        userId: string,
        params: {
            skip?: number;
            limit?: number;
            communityId?: string;
            type?: string;
        } = {}
    ): Promise<PaginatedResponse<Transaction>> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<Transaction>;
        }>(`/api/v1/users/${userId}/transactions`, { params });
        return response.data;
    },

    async getUserQuota(
        userId: string,
        communityId?: string
    ): Promise<{
        dailyQuota: number;
        usedToday: number;
        remainingToday: number;
        resetAt: string;
    }> {
        const params = communityId ? { communityId } : {};
        const response = await apiClient.get<{
            success: boolean;
            data: {
                dailyQuota: number;
                usedToday: number;
                remainingToday: number;
                resetAt: string;
            };
            meta?: any;
        }>(`/api/v1/users/${userId}/quota`, { params });
        // Extract data from wrapped response
        return response?.data || response;
    },

    async getUpdatesFrequency(): Promise<{ frequency: string }> {
        const response = await apiClient.get<{
            success: true;
            data: { frequency: string };
        }>("/api/v1/users/me/updates-frequency");
        return response.data;
    },

    async setUpdatesFrequency(
        frequency: string
    ): Promise<{ frequency: string }> {
        const response = await apiClient.put<{
            success: true;
            data: { frequency: string };
        }>("/api/v1/users/me/updates-frequency", { frequency });
        return response.data;
    },

    async searchUsers(query: string, limit: number = 20): Promise<User[]> {
        const response = await apiClient.get<{ success: true; data: User[] }>(
            "/api/v1/users/search",
            { params: { q: query, limit } }
        );
        return response.data;
    },

    async updateGlobalRole(
        userId: string,
        role: "superadmin" | "user"
    ): Promise<User> {
        const response = await apiClient.put<{ success: true; data: User }>(
            `/api/v1/users/${userId}/global-role`,
            { role }
        );
        return response.data;
    },

    async getAllLeads(
        params: { skip?: number; limit?: number; page?: number; pageSize?: number } = {}
    ): Promise<PaginatedResponse<User>> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<User>;
        }>("/api/v1/users/leads", { params });
        return response.data;
    },
};

// Communities API
export const communitiesApiV1 = {
    async getCommunities(
        params: { skip?: number; limit?: number } = {}
    ): Promise<PaginatedResponse<Community>> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<Community>;
        }>("/api/v1/communities", { params });
        return response.data;
    },

    async getCommunity(id: string): Promise<Community> {
        // Backend may return either a wrapped { success, data } or a direct object.
        const response = await apiClient.get<any>(`/api/v1/communities/${id}`);
        if (
            response &&
            typeof response === "object" &&
            "data" in response &&
            response.data
        ) {
            return response.data as Community;
        }
        return response as Community;
    },

    async createCommunity(data: {
        name: string;
        description?: string;
        [key: string]: unknown;
    }): Promise<Community> {
        const response = await apiClient.post<{
            success: true;
            data: Community;
        }>("/api/v1/communities", data);
        return response.data;
    },

    async createFakeCommunity(): Promise<Community> {
        const response = await apiClient.post<{
            success: boolean;
            data: Community;
            error?: string;
        }>("/api/v1/communities/fake-community", {});
        if (!response.success || !response.data) {
            throw new Error(
                response.error || "Failed to create fake community"
            );
        }
        return response.data;
    },

    async addUserToAllCommunities(): Promise<{
        added: number;
        skipped: number;
        total: number;
        errors?: string[];
    }> {
        const response = await apiClient.post<{
            success: boolean;
            data: {
                added: number;
                skipped: number;
                total: number;
                errors?: string[];
            };
            error?: string;
        }>("/api/v1/communities/add-user-to-all", {});
        if (!response.success || !response.data) {
            throw new Error(
                response.error || "Failed to add user to all communities"
            );
        }
        return response.data;
    },

    async updateCommunity(
        id: string,
        data: UpdateCommunityDto
    ): Promise<Community> {
        const response = await apiClient.put<{
            success: true;
            data: Community;
        }>(`/api/v1/communities/${id}`, data);
        return response.data;
    },

    async deleteCommunity(id: string): Promise<void> {
        await apiClient.delete(`/api/v1/communities/${id}`);
    },

    async resetDailyQuota(
        communityId: string
    ): Promise<{ success: boolean; resetAt: string }> {
        const response = await apiClient.post<{
            success: true;
            data: { resetAt: string };
        }>(`/api/v1/communities/${communityId}/reset-quota`);
        return { success: response.success, resetAt: response.data.resetAt };
    },

    async sendUsageMemo(communityId: string): Promise<{ success: boolean }> {
        const response = await apiClient.post<{
            success: true;
            data: { sent: boolean };
        }>(`/api/v1/communities/${communityId}/send-memo`);
        return { success: response.success };
    },

    async getCommunityMembers(
        id: string,
        params: { skip?: number; limit?: number } = {}
    ): Promise<PaginatedResponse<CommunityMember>> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<CommunityMember>;
        }>(`/api/v1/communities/${id}/members`, { params });
        return response.data;
    },

    async getCommunityPublications(
        id: string,
        params: {
            skip?: number;
            limit?: number;
            page?: number;
            pageSize?: number;
            sort?: string;
            order?: string;
        } = {}
    ): Promise<PaginatedResponse<Publication>> {
        // Use query utility to build params
        const queryParams = mergeQueryParams(
            params.page !== undefined ? { page: params.page } : {},
            params.pageSize !== undefined ? { pageSize: params.pageSize } : {},
            params.skip !== undefined ? { skip: params.skip } : {},
            params.limit !== undefined ? { limit: params.limit } : {},
            params.sort ? { sort: params.sort } : {},
            params.order ? { order: params.order } : {}
        );

        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<Publication>;
        }>(`/api/v1/communities/${id}/publications`, { params: queryParams });
        return response.data;
    },

    async getCommunityPolls(
        id: string,
        params: { skip?: number; limit?: number } = {}
    ): Promise<PaginatedResponse<Poll>> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<Poll>;
        }>(`/api/v1/communities/${id}/polls`, { params });
        return response.data;
    },

    async getCommunityLeaderboard(
        id: string,
        params: { skip?: number; limit?: number } = {}
    ): Promise<PaginatedResponse<LeaderboardEntry>> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<LeaderboardEntry>;
        }>(`/api/v1/communities/${id}/leaderboard`, { params });
        return response.data;
    },

    async getCommunityFeed(
        id: string,
        params: {
            page?: number;
            pageSize?: number;
            sort?: "recent" | "score";
            tag?: string;
            search?: string; // Optional search query parameter
        } = {}
    ): Promise<PaginatedResponse<any>> {
        const queryParams = mergeQueryParams(
            params.page !== undefined ? { page: params.page } : {},
            params.pageSize !== undefined ? { pageSize: params.pageSize } : {},
            params.sort ? { sort: params.sort } : {},
            params.tag ? { tag: params.tag } : {},
            params.search ? { search: params.search } : {} // Add search parameter if provided
        );

        const response = await apiClient.get<{
            success: true;
            data: any[];
            meta: {
                pagination: {
                    page: number;
                    pageSize: number;
                    total: number;
                    hasNext: boolean;
                    hasPrev: boolean;
                };
            };
        }>(`/api/v1/communities/${id}/feed`, { params: queryParams });

        return {
            data: response.data,
            meta: {
                pagination: {
                    page: response.meta.pagination.page,
                    pageSize: response.meta.pagination.pageSize,
                    total: response.meta.pagination.total,
                    totalPages: Math.ceil(
                        response.meta.pagination.total /
                            response.meta.pagination.pageSize
                    ),
                    hasNext: response.meta.pagination.hasNext,
                    hasPrev: response.meta.pagination.hasPrev,
                },
                timestamp: new Date().toISOString(),
                requestId: "",
            },
        };
    },
};

// Publications API with Zod validation and query parameter transformations
export const publicationsApiV1 = {
    async getPublications(
        params: {
            skip?: number;
            limit?: number;
            type?: string;
            communityId?: string;
            userId?: string;
            tag?: string;
            sort?: string;
            order?: string;
        } = {}
    ): Promise<Publication[]> {
        // Convert skip/limit to page/pageSize for API
        const page =
            params.skip !== undefined && params.limit !== undefined
                ? Math.floor(params.skip / params.limit) + 1
                : undefined;

        const queryParams = mergeQueryParams(
            page !== undefined ? { page } : {},
            params.limit !== undefined ? { pageSize: params.limit } : {},
            params.sort ? { sort: params.sort } : {},
            params.order ? { order: params.order } : {},
            params.communityId ? { communityId: params.communityId } : {},
            params.userId ? { authorId: params.userId } : {}, // Transform userId to authorId
            params.tag ? { hashtag: params.tag } : {} // Transform tag to hashtag
        );

        const queryString = buildQueryString(queryParams);
        const response = await apiClient.get<{
            success: true;
            data: Publication[];
        }>(`/api/v1/publications${queryString ? `?${queryString}` : ""}`);
        return response.data;
    },

    async getMyPublications(
        params: { skip?: number; limit?: number } = {}
    ): Promise<Publication[]> {
        // Use query utility to build params
        const queryParams = mergeQueryParams(
            params.skip !== undefined ? { skip: params.skip } : {},
            params.limit !== undefined ? { limit: params.limit } : {}
        );

        const queryString = buildQueryString(queryParams);
        const response = await apiClient.get<
            | { success: true; data: PaginatedResponse<Publication> }
            | { success: true; data: Publication[] }
        >(
            `/api/v1/users/me/publications${
                queryString ? `?${queryString}` : ""
            }`
        );

        // Handle both response formats: PaginatedResponse or direct array
        if (
            response.data &&
            typeof response.data === "object" &&
            "data" in response.data &&
            Array.isArray(response.data.data)
        ) {
            // PaginatedResponse format
            return response.data.data;
        } else if (Array.isArray(response.data)) {
            // Direct array format
            return response.data;
        }
        return [];
    },

    async getPublicationsByCommunity(
        communityId: string,
        params: {
            skip?: number;
            limit?: number;
            sort?: string;
            order?: string;
        } = {}
    ): Promise<Publication[]> {
        const pagination = convertPaginationToSkipLimit(
            params.skip
                ? Math.floor(params.skip / (params.limit || 10)) + 1
                : undefined,
            params.limit
        );

        const queryParams = mergeQueryParams(
            { communityId },
            {
                page: pagination.skip
                    ? Math.floor(pagination.skip / (pagination.limit || 10)) + 1
                    : undefined,
            },
            { pageSize: pagination.limit },
            params.sort ? { sort: params.sort } : {},
            params.order ? { order: params.order } : {}
        );

        const queryString = buildQueryString(queryParams);
        const response = await apiClient.get<{
            success: true;
            data: Publication[];
        }>(`/api/v1/publications?${queryString}`);
        return response.data;
    },

    async getPublication(id: string): Promise<{ success: true; data: Publication }> {
        const response = await apiClient.get<{
            success: true;
            data: Publication;
        }>(`/api/v1/publications/${id}`);
        // Return full response for useValidatedQuery to validate
        return response;
    },

    async createPublication(
        data: CreatePublicationDto
    ): Promise<{ success: true; data: Publication }> {
        const response = await apiClient.post<{
            success: true;
            data: Publication;
        }>("/api/v1/publications", data);
        // Return full response for useValidatedMutation to validate
        return response;
    },

    async updatePublication(
        id: string,
        data: UpdatePublicationDto
    ): Promise<{ success: true; data: Publication }> {
        const normalizedId = id?.trim();
        if (!normalizedId || normalizedId === 'undefined' || normalizedId === 'null') {
            throw new Error('Publication ID is required to update a publication');
        }
        const response = await apiClient.put<{
            success: true;
            data: Publication;
        }>(`/api/v1/publications/${normalizedId}`, data);
        // Return full response for useValidatedMutation to validate
        return response;
    },

    async deletePublication(id: string): Promise<{ success: boolean }> {
        return apiClient.delete(`/api/v1/publications/${id}`);
    },

    async generateFakeData(
        type: "user" | "beneficiary",
        communityId?: string
    ): Promise<{ publications: Publication[]; count: number }> {
        const response = await apiClient.post<{
            success: boolean;
            data: { publications: Publication[]; count: number };
            error?: string;
        }>("/api/v1/publications/fake-data", { type, communityId });

        if (!response) {
            throw new Error("No response data received from server");
        }

        if (!response.success) {
            throw new Error(response.error || "Failed to generate fake data");
        }

        if (!response.data) {
            throw new Error("No data received from server");
        }

        return response.data;
    },
};

// Comments API with hierarchical endpoints
export const commentsApiV1 = {
    async getComments(
        params: {
            skip?: number;
            limit?: number;
            publicationId?: string;
            userId?: string;
        } = {}
    ): Promise<PaginatedResponse<Comment>> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<Comment>;
        }>("/api/v1/comments", { params });
        return response.data;
    },

    async getComment(id: string): Promise<Comment> {
        const response = await apiClient.get<{ success: true; data: Comment }>(
            `/api/v1/comments/${id}`
        );
        return response.data;
    },

    async createComment(data: CreateCommentDto): Promise<Comment> {
        const response = await apiClient.post<{ success: true; data: Comment }>(
            "/api/v1/comments",
            data
        );
        // Workaround for TypeScript's "Type instantiation is excessively deep" error
        return validateApiResponse(CommentSchema as any, response, "createComment");
    },

    async updateComment(
        id: string,
        data: Partial<CreateCommentDto>
    ): Promise<Comment> {
        const response = await apiClient.put<{ success: true; data: Comment }>(
            `/api/v1/comments/${id}`,
            data
        );
        return response.data;
    },

    async deleteComment(id: string): Promise<void> {
        await apiClient.delete(`/api/v1/comments/${id}`);
    },

    async getPublicationComments(
        publicationId: string,
        params: {
            skip?: number;
            limit?: number;
            sort?: string;
            order?: string;
        } = {}
    ): Promise<PaginatedResponse<Comment>> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<Comment>;
        }>(`/api/v1/comments/publications/${publicationId}`, { params });
        return response.data;
    },

    async getCommentReplies(
        commentId: string,
        params: {
            skip?: number;
            limit?: number;
            sort?: string;
            order?: string;
        } = {}
    ): Promise<PaginatedResponse<Comment>> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<Comment>;
        }>(`/api/v1/comments/${commentId}/replies`, { params });
        return response.data;
    },

    async getCommentDetails(id: string): Promise<{
        comment: Comment;
        author: {
            id: string;
            name: string;
            username?: string;
            photoUrl?: string;
        };
        voteTransaction: {
            amountTotal: number;
            plus: number;
            minus: number;
            directionPlus: boolean;
            sum: number;
        } | null;
        beneficiary: {
            id: string;
            name: string;
            username?: string;
            photoUrl?: string;
        } | null;
        community: {
            id: string;
            name: string;
            avatarUrl?: string;
            iconUrl?: string;
        } | null;
        metrics: {
            upvotes: number;
            downvotes: number;
            score: number;
            totalReceived: number;
        };
        withdrawals: {
            totalWithdrawn: number;
        };
    }> {
        const response = await apiClient.get<{
            success: true;
            data: {
                comment: Comment;
                author: {
                    id: string;
                    name: string;
                    username?: string;
                    photoUrl?: string;
                };
                voteTransaction: {
                    amountTotal: number;
                    plus: number;
                    minus: number;
                    directionPlus: boolean;
                    sum: number;
                } | null;
                beneficiary: {
                    id: string;
                    name: string;
                    username?: string;
                    photoUrl?: string;
                } | null;
                community: {
                    id: string;
                    name: string;
                    avatarUrl?: string;
                    iconUrl?: string;
                } | null;
                metrics: {
                    upvotes: number;
                    downvotes: number;
                    score: number;
                    totalReceived: number;
                };
                withdrawals: {
                    totalWithdrawn: number;
                };
            };
        }>(`/api/v1/comments/${id}/details`);
        return response.data;
    },
};

// Votes API with complex response structures and missing endpoints
export const votesApiV1 = {
    async voteOnPublication(
        publicationId: string,
        data: VoteWithCommentDto
    ): Promise<{ vote: Vote; comment?: Comment; wallet: Wallet }> {
        const response = await apiClient.post<{
            success: true;
            data: { vote: Vote; comment?: Comment; wallet: Wallet };
        }>(`/api/v1/publications/${publicationId}/votes`, data);
        return response.data;
    },

    async voteOnVote(
        voteId: string,
        data: VoteWithCommentDto
    ): Promise<{ vote: Vote; comment?: Comment; wallet: Wallet }> {
        // Check feature flag - comment voting is disabled by default
        // Note: This is a client-side check. The backend also validates the feature flag.
        const enableCommentVoting = typeof window !== 'undefined' 
            ? (process.env.NEXT_PUBLIC_ENABLE_COMMENT_VOTING === 'true')
            : false;
        
        if (!enableCommentVoting) {
            throw new Error('Voting on comments is disabled. You can only vote on posts/publications.');
        }
        
        const response = await apiClient.post<{
            success: true;
            data: { vote: Vote; comment?: Comment; wallet: Wallet };
        }>(`/api/v1/votes/${voteId}/votes`, data);
        return response.data;
    },

    async getPublicationVotes(
        publicationId: string,
        params: { page?: number; pageSize?: number } = {}
    ): Promise<{ data: Vote[] }> {
        const response = await apiClient.get<{
            success: true;
            data: { data: Vote[] };
        }>(`/api/v1/publications/${publicationId}/votes`, { params });
        return response.data;
    },

    async getCommentVotes(
        commentId: string,
        params: { page?: number; pageSize?: number } = {}
    ): Promise<{ data: Vote[] }> {
        const response = await apiClient.get<{
            success: true;
            data: { data: Vote[] };
        }>(`/api/v1/comments/${commentId}/votes`, { params });
        return response.data;
    },

    async removePublicationVote(publicationId: string): Promise<void> {
        await apiClient.delete(`/api/v1/publications/${publicationId}/votes`);
    },

    async removeCommentVote(commentId: string): Promise<void> {
        await apiClient.delete(`/api/v1/comments/${commentId}/votes`);
    },

    async getVoteDetails(
        voteId: string
    ): Promise<{ vote: Vote; comment?: Comment }> {
        const response = await apiClient.get<{
            success: true;
            data: { vote: Vote; comment?: Comment };
        }>(`/api/v1/votes/${voteId}/details`);
        return response.data;
    },

    async voteOnPublicationWithComment(
        publicationId: string,
        data: {
            quotaAmount?: number;
            walletAmount?: number;
            comment?: string;
            direction?: 'up' | 'down';
        }
    ): Promise<{ vote: Vote; comment?: Comment }> {
        // Use the regular vote endpoint (vote-with-comment endpoint was removed)
        return this.voteOnPublication(publicationId, data);
    },

    async withdrawFromPublication(
        publicationId: string,
        data: { amount?: number }
    ): Promise<{
        success: boolean;
        data: { amount: number; balance: number; message: string };
    }> {
        try {
            const response = await apiClient.post<{
                success: boolean;
                data: { amount: number; balance: number; message: string };
                meta: any;
            }>(`/api/v1/publications/${publicationId}/withdraw`, data);
            return response;
        } catch (error: any) {
            console.error("[API] withdrawFromPublication error:", {
                error,
                errorType: typeof error,
                errorKeys: error ? Object.keys(error) : [],
                errorMessage: error?.message,
                errorResponse: error?.response,
                errorDetails: error?.details,
                errorCode: error?.code,
            });
            throw error;
        }
    },

    async withdrawFromVote(
        voteId: string,
        data: { amount?: number }
    ): Promise<{
        success: boolean;
        data: { amount: number; balance: number; message: string };
    }> {
        const response = await apiClient.post<{
            success: boolean;
            data: { amount: number; balance: number; message: string };
            meta: any;
        }>(`/api/v1/votes/${voteId}/withdraw`, data);
        return response;
    },
};

/**
 * Unwraps API response ensuring type safety with Zod validation
 * Throws error if response structure is invalid
 * @deprecated Use validateApiResponse directly instead
 */
function unwrapApiResponse<T>(
    response: { success: true; data: T },
    schema?: any,
    context?: string
): T {
    if (!response || !response.success || response.data === undefined) {
        throw new Error("Invalid API response structure");
    }
    if (schema) {
        return validateApiResponse(schema, response, context);
    }
    return response.data;
}

// Polls API
export const pollsApiV1 = {
    async getPolls(
        params: {
            skip?: number;
            limit?: number;
            communityId?: string;
            userId?: string;
        } = {}
    ): Promise<PaginatedResponse<Poll>> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<Poll>;
        }>("/api/v1/polls", { params });
        // Note: PaginatedResponse validation would need a schema wrapper
        return response.data;
    },

    async getPoll(id: string): Promise<Poll> {
        const response = await apiClient.get<{ success: true; data: Poll }>(
            `/api/v1/polls/${id}`
        );
        // Workaround for TypeScript's "Type instantiation is excessively deep" error
        return validateApiResponse(PollSchema as any, response, "getPoll");
    },

    async createPoll(data: CreatePollDto): Promise<Poll> {
        const response = await apiClient.post<{ success: true; data: Poll }>(
            "/api/v1/polls",
            data
        );
        // Workaround for TypeScript's "Type instantiation is excessively deep" error
        return validateApiResponse(PollSchema as any, response, "createPoll");
    },

    async updatePoll(id: string, data: UpdatePollDto): Promise<Poll> {
        const response = await apiClient.put<{ success: true; data: Poll }>(
            `/api/v1/polls/${id}`,
            data
        );
        // Workaround for TypeScript's "Type instantiation is excessively deep" error
        return validateApiResponse(PollSchema as any, response, "updatePoll");
    },

    async deletePoll(id: string): Promise<void> {
        await apiClient.delete(`/api/v1/polls/${id}`);
    },

    async castPoll(pollId: string, data: CreatePollCastDto): Promise<PollCast> {
        const response = await apiClient.post<{
            success: true;
            data: PollCast;
        }>(`/api/v1/polls/${pollId}/casts`, data);
        // Note: PollCast schema would need to be imported
        return response.data;
    },

    async getPollResults(pollId: string): Promise<any> {
        const response = await apiClient.get<{ success: true; data: any }>(
            `/api/v1/polls/${pollId}/results`
        );
        return response.data;
    },

    async getMyPollCasts(pollId: string): Promise<any> {
        const response = await apiClient.get<{ success: true; data: any }>(
            `/api/v1/polls/${pollId}/my-casts`
        );
        return response.data;
    },
};

// Wallet API with missing functionality
export const walletApiV1 = {
    async getWallets(): Promise<Wallet[]> {
        const response = await apiClient.get<{ success: true; data: Wallet[] }>(
            "/api/v1/users/me/wallets"
        );
        return response.data;
    },

    async getBalance(communityId: string): Promise<number> {
        const response = await apiClient.get<{ success: true; data: Wallet }>(
            `/api/v1/users/me/wallets/${communityId}`
        );
        return response.data.balance;
    },

    async getTransactions(
        params: {
            skip?: number;
            limit?: number;
            positive?: boolean;
            userId?: string;
        } = {}
    ): Promise<PaginatedResponse<Transaction>> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<Transaction>;
        }>("/api/v1/users/me/transactions", { params });
        return response.data;
    },

    async getTransactionUpdates(): Promise<Transaction[]> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<Transaction>;
        }>("/api/v1/users/me/transactions", {
            params: { updates: true },
        });
        return response.data.data || response.data;
    },

    async getAllTransactions(
        params: {
            skip?: number;
            limit?: number;
            userId?: string;
            communityId?: string;
        } = {}
    ): Promise<PaginatedResponse<Transaction>> {
        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<Transaction>;
        }>("/api/v1/users/me/transactions", { params });
        return response.data;
    },

    async withdraw(
        communityId: string,
        data: { amount: number; memo?: string }
    ): Promise<Transaction> {
        const response = await apiClient.post<{
            success: true;
            data: Transaction;
        }>(`/api/v1/users/me/wallets/${communityId}/withdraw`, data);
        return response.data;
    },

    async transfer(
        communityId: string,
        data: { toUserId: string; amount: number; description?: string }
    ): Promise<Transaction> {
        const response = await apiClient.post<{
            success: true;
            data: Transaction;
        }>(`/api/v1/users/me/wallets/${communityId}/transfer`, data);
        return response.data;
    },

    async getFreeBalance(communityId: string): Promise<number> {
        const response = await apiClient.get<{ success: true; data: number }>(
            `/api/v1/users/me/quota?communityId=${communityId}`
        );
        return response.data;
    },
};


// Search API - unified search across all content types
export const searchApiV1 = {
    async search(
        params: {
            query?: string;
            contentType?:
                | "all"
                | "publications"
                | "comments"
                | "polls"
                | "communities"
                | "users";
            tags?: string[];
            authorId?: string;
            communityId?: string;
            dateFrom?: string;
            dateTo?: string;
            page?: number;
            pageSize?: number;
        } = {}
    ): Promise<{
        results: Array<{
            type: string;
            id: string;
            title: string;
            description?: string;
            author?: { id: string; name: string; avatarUrl?: string };
            community?: { id: string; name: string; avatarUrl?: string };
            tags?: string[];
            createdAt: string;
            score?: number;
            url: string;
        }>;
        meta: {
            total: number;
            contentType: string;
            timestamp: string;
            requestId: string;
        };
    }> {
        // For now, we'll aggregate results from existing endpoints
        // In the future, this should call a dedicated /api/v1/search endpoint

        const {
            query,
            contentType = "all",
            tags,
            authorId,
            communityId,
            dateFrom,
            dateTo,
            page = 1,
            pageSize = 20,
        } = params;

        // If no query and no filters, return empty results
        if (!query && !tags?.length && !authorId && !communityId) {
            return {
                results: [],
                meta: {
                    total: 0,
                    contentType,
                    timestamp: new Date().toISOString(),
                    requestId: "",
                },
            };
        }

        const results: any[] = [];

        // Search publications
        if (contentType === "all" || contentType === "publications") {
            try {
                const publications = await publicationsApiV1.getPublications({
                    skip: (page - 1) * pageSize,
                    limit: pageSize,
                    tag: tags?.[0], // Use first tag for now
                    userId: authorId,
                    communityId,
                });

                publications.forEach((pub: Publication) => {
                    // Simple text matching if query provided
                    if (query) {
                        const searchText = `${pub.title || ""} ${
                            pub.content || ""
                        }`.toLowerCase();
                        if (!searchText.includes(query.toLowerCase())) {
                            return;
                        }
                    }

                    // Use type assertion to avoid TypeScript errors with Publication type
                    const pubAny = pub as any;
                    const author = pubAny.author
                        ? {
                              id: pubAny.author.id || "",
                              name: pubAny.author.name || "Unknown",
                              avatarUrl: pubAny.author.avatarUrl,
                          }
                        : undefined;

                    const community = pubAny.community
                        ? {
                              id: pubAny.community.id || "",
                              name: pubAny.community.name || "Unknown",
                              avatarUrl: pubAny.community.avatarUrl,
                          }
                        : undefined;

                    results.push({
                        type: "publications",
                        id: pub.id,
                        title: pub.title || "Untitled",
                        description: pub.content?.substring(0, 200),
                        author,
                        community,
                        tags: pubAny.hashtags,
                        createdAt: pub.createdAt,
                        score: pubAny.score,
                        url: `/meriter/communities/${
                            community?.id || "unknown"
                        }/publications/${pub.id}`,
                    });
                });
            } catch (error) {
                console.warn("Search publications failed:", error);
            }
        }

        // Search communities
        if (contentType === "all" || contentType === "communities") {
            try {
                const communities = await communitiesApiV1.getCommunities({
                    skip: (page - 1) * pageSize,
                    limit: pageSize,
                });

                communities.data.forEach((comm: Community) => {
                    if (query) {
                        const searchText = `${comm.name || ""} ${
                            comm.description || ""
                        }`.toLowerCase();
                        if (!searchText.includes(query.toLowerCase())) {
                            return;
                        }
                    }

                    results.push({
                        type: "communities",
                        id: comm.id,
                        title: comm.name || "Unnamed Community",
                        description: comm.description,
                        createdAt: comm.createdAt,
                        url: `/meriter/communities/${comm.id}`,
                    });
                });
            } catch (error) {
                console.warn("Search communities failed:", error);
            }
        }

        // Search polls (if needed)
        if (contentType === "all" || contentType === "polls") {
            try {
                const polls = await pollsApiV1.getPolls({
                    skip: (page - 1) * pageSize,
                    limit: pageSize,
                    communityId,
                });

                polls.data.forEach((poll: Poll) => {
                    const pollAny = poll as any;
                    if (query) {
                        const searchText = `${
                            pollAny.question || pollAny.title || ""
                        } ${pollAny.description || ""}`.toLowerCase();
                        if (!searchText.includes(query.toLowerCase())) {
                            return;
                        }
                    }

                    const pollCommunity = pollAny.community;
                    const community = pollCommunity
                        ? {
                              id: pollCommunity.id || "",
                              name: pollCommunity.name || "Unknown",
                              avatarUrl: pollCommunity.avatarUrl,
                          }
                        : undefined;

                    results.push({
                        type: "polls",
                        id: poll.id,
                        title:
                            pollAny.question ||
                            pollAny.title ||
                            "Untitled Poll",
                        description: pollAny.description,
                        community,
                        createdAt: poll.createdAt,
                        url: `/meriter/communities/${
                            community?.id || "unknown"
                        }/polls/${poll.id}`,
                    });
                });
            } catch (error) {
                console.warn("Search polls failed:", error);
            }
        }

        return {
            results: results.slice(0, pageSize), // Limit total results
            meta: {
                total: results.length,
                contentType,
                timestamp: new Date().toISOString(),
                requestId: "",
            },
        };
    },
};

// Notifications API
export const notificationsApiV1 = {
    async getNotifications(
        params: {
            page?: number;
            pageSize?: number;
            unreadOnly?: boolean;
            type?: string;
        } = {}
    ): Promise<PaginatedResponse<import("@/types/api-v1").Notification>> {
        const queryParams: Record<string, string> = {};
        if (params.page !== undefined) {
            queryParams.page = params.page.toString();
        }
        if (params.pageSize !== undefined) {
            queryParams.pageSize = params.pageSize.toString();
        }
        if (params.unreadOnly !== undefined) {
            queryParams.unreadOnly = params.unreadOnly.toString();
        }
        if (params.type) {
            queryParams.type = params.type;
        }

        const response = await apiClient.get<{
            success: true;
            data: PaginatedResponse<import("@/types/api-v1").Notification>;
        }>("/api/v1/notifications", { params: queryParams });
        return response.data;
    },

    async getUnreadCount(): Promise<number> {
        const response = await apiClient.get<{ success: true; data: number }>(
            "/api/v1/notifications/unread-count"
        );
        return response.data;
    },

    async markAsRead(notificationId: string): Promise<void> {
        await apiClient.post(`/api/v1/notifications/${notificationId}/read`);
    },

    async markAllAsRead(): Promise<void> {
        await apiClient.post("/api/v1/notifications/read-all");
    },

    async deleteNotification(notificationId: string): Promise<void> {
        await apiClient.delete(`/api/v1/notifications/${notificationId}`);
    },

    async getPreferences(): Promise<
        import("@/types/api-v1").NotificationPreferences
    > {
        const response = await apiClient.get<{
            success: true;
            data: import("@/types/api-v1").NotificationPreferences;
        }>("/api/v1/notifications/preferences");
        return response.data;
    },

    async updatePreferences(
        preferences: Partial<import("@/types/api-v1").NotificationPreferences>
    ): Promise<void> {
        await apiClient.put("/api/v1/notifications/preferences", preferences);
    },
};

// Import new APIs
import { invitesApiV1 } from "./invites";
import { profileApiV1 } from "./profile";

// Export all APIs
export const apiV1 = {
    auth: authApiV1,
    users: usersApiV1,
    communities: communitiesApiV1,
    publications: publicationsApiV1,
    comments: commentsApiV1,
    votes: votesApiV1,
    polls: pollsApiV1,
    wallet: walletApiV1,
    invites: invitesApiV1,
    profile: profileApiV1,
    search: searchApiV1,
    notifications: notificationsApiV1,
};

// Export individual APIs for convenience
export { invitesApiV1, profileApiV1 };
