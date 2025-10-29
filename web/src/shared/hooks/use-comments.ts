import { useState, useMemo } from "react";
import { useQuery } from '@tanstack/react-query';
import { commentsApiV1 } from '@/lib/api/v1';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import type { Dispatch, SetStateAction } from 'react';
import { useVoteOnComment } from '@/hooks/api/useVotes';
import { useCreateComment, commentsKeys } from '@/hooks/api/useComments';
import { useUserQuota } from '@/hooks/api/useQuota';

const { round } = Math;

interface Wallet {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  [key: string]: unknown;
}

export const useComments = (
    forTransaction: boolean,
    publicationSlug: string,
    transactionId: string,
    _getCommentsApiPath: string, // Legacy parameter, no longer used
    _getFreeBalanceApiPath: string, // Legacy parameter, no longer used
    balance: Wallet | number | null,
    updBalance: () => Promise<void>,
    plusGiven: number,
    minusGiven: number,
    activeCommentHook: [string | null, Dispatch<SetStateAction<string | null>>],
    onlyPublication = false,
    communityId?: string,
    wallets?: Wallet[]
) => {
    const t = useTranslations('comments');
    const uid = transactionId || publicationSlug;
    const [showComments, setShowComments] = useState(!!onlyPublication);
    const [comment, setCommentW] = useState("");
    const setComment = (c: string) => {
        setCommentW(c);
        setError("");
    };

    const [plusSign, setPlusSign] = useState(true);
    const [delta, setDelta] = useState(0);
    const [error, setError] = useState("");
    
    // Mutation hooks
    const voteOnCommentMutation = useVoteOnComment();
    const createCommentMutation = useCreateComment();

    // Get comments using v1 API with standard query keys
    const { data: comments = [] } = useQuery({
        queryKey: forTransaction && transactionId
            ? [...commentsKeys.byComment(transactionId), { sort: 'createdAt', order: 'desc' }]
            : publicationSlug
            ? [...commentsKeys.byPublication(publicationSlug), { sort: 'createdAt', order: 'desc' }]
            : ['comments', 'empty'],
        queryFn: async () => {
            if (forTransaction && transactionId) {
                // Get replies to a comment, sorted by newest first
                const result = await commentsApiV1.getCommentReplies(transactionId, {
                    sort: 'createdAt',
                    order: 'desc',
                });
                // Handle PaginatedResponse structure - result is PaginatedResponse, result.data is the array
                return (result && result.data && Array.isArray(result.data)) ? result.data : [];
            } else if (publicationSlug) {
                // Get comments on a publication, sorted by newest first
                const result = await commentsApiV1.getPublicationComments(publicationSlug, {
                    sort: 'createdAt',
                    order: 'desc',
                });
                // Handle PaginatedResponse structure - result is PaginatedResponse, result.data is the array
                return (result && result.data && Array.isArray(result.data)) ? result.data : [];
            }
            return [];
        },
        refetchOnWindowFocus: false,
        // Prevent N+1 queries: only fetch replies when user expands a comment (showComments=true)
        // For publication comments, always fetch (showComments is already true for onlyPublication)
        enabled: forTransaction ? showComments && !!transactionId : !!publicationSlug,
    });

    // Get user quota for free balance using standardized hook
    const { user } = useAuth();
    const { data: quotaData } = useUserQuota(communityId);
    
    // Transform quota data to { plus, minus } format for backwards compatibility
    const free = useMemo(() => {
        if (!quotaData) return { plus: 0, minus: 0 };
        return {
            plus: quotaData.remainingToday || 0,
            minus: 0,
        };
    }, [quotaData]);

    const currentPlus = round(
        (plusGiven + (delta as any)) || 0
    );
    const currentMinus = round(
        (minusGiven + (delta as any)) || 0
    );

    const showPlus = () => {
        setError("");
        setDelta(1);
        setShowComments(true);
        if (activeCommentHook) {
            activeCommentHook[1](uid);
        }
    };
    const showMinus = () => {
        setError("");
        setDelta(-1);
        setShowComments(true);
        if (activeCommentHook) {
            activeCommentHook[1](uid);
        }
    };

    // Extract wallet balance from balance prop or wallets array
    // balance can be a Wallet object, a number, or null
    // If communityId is provided and wallets array is available, prefer wallet from that community
    let walletBalance = 0;
    if (communityId && wallets && Array.isArray(wallets)) {
        const wallet = wallets.find((w: Wallet) => w.communityId === communityId);
        walletBalance = wallet?.balance || 0;
    } else if (typeof balance === 'number') {
        walletBalance = balance;
    } else if (balance && typeof balance === 'object' && 'balance' in balance && typeof balance.balance === 'number') {
        walletBalance = balance.balance;
    }

    const formCommentProps = {
        uid,
        // User has points if they have either quota OR wallet balance
        hasPoints: (free?.plus || 0) > 0 || walletBalance > 0,
        comment,
        setComment,
        amount: Math.abs(delta),
        setAmount: setDelta,
        free: free?.plus || 0,
        // maxPlus should consider both quota and wallet balance
        maxPlus: Math.max(free?.plus || 0, walletBalance || 0),
        maxMinus: free?.minus || 0,
        commentAdd: async (directionPlus: boolean) => {
            try {
                // Use mutation hooks based on whether it's a comment or vote
                if (forTransaction) {
                    // This is a vote for a comment
                    await voteOnCommentMutation.mutateAsync({
                        commentId: transactionId,
                        data: {
                            targetType: 'comment',
                            targetId: transactionId,
                            amount: directionPlus ? Math.abs(delta) : -Math.abs(delta),
                            sourceType: 'quota',
                        },
                        communityId,
                    });
                    // Create comment separately if there's comment text
                    if (comment.trim()) {
                        await createCommentMutation.mutateAsync({
                            targetType: 'comment',
                            targetId: transactionId,
                            content: comment.trim(),
                        });
                    }
                    setComment("");
                    setDelta(0);
                    setError("");
                    updBalance();
                    if (activeCommentHook) {
                        activeCommentHook[1](null);
                    }
                } else {
                    // This is a comment on a publication
                    await createCommentMutation.mutateAsync({
                        targetType: 'publication',
                        targetId: publicationSlug,
                        content: comment.trim(),
                    });
                    setComment("");
                    setDelta(0);
                    setError("");
                    updBalance();
                    if (activeCommentHook) {
                        activeCommentHook[1](null);
                    }
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : t('errorCommenting');
                setError(message);
            }
        },
        error,
        onClose: () => {
            if (activeCommentHook) {
                activeCommentHook[1](null);
            }
        },
    };

    return {
        comments,
        free,
        currentPlus,
        currentMinus,
        showPlus,
        showMinus,
        showComments,
        setShowComments,
        formCommentProps,
    };
};