import { useState, useMemo } from "react";
import { useQuery } from '@tanstack/react-query';
import { commentsApiV1 } from '@/lib/api/v1';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import type { Dispatch, SetStateAction } from 'react';
import { useVoteOnVote } from '@/hooks/api/useVotes';
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
    balance: Wallet | number | null,
    _updBalance: () => Promise<void>, // Legacy parameter - mutations handle invalidation
    plusGiven: number,
    minusGiven: number,
    activeCommentHook: [string | null, Dispatch<SetStateAction<string | null>>],
    onlyPublication = false,
    communityId?: string,
    wallets?: Wallet[],
    sortBy: 'recent' | 'voted' = 'recent'
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
    const voteOnVoteMutation = useVoteOnVote();
    const createCommentMutation = useCreateComment();

    // Map sort preference to API parameters
    const apiSort = sortBy === 'voted' ? 'score' : 'createdAt';
    const apiOrder = 'desc'; // Always descending for both recent and voted

    // Get comments using v1 API with standard query keys
    const { data: comments = [] } = useQuery({
        queryKey: forTransaction && transactionId
            ? [...commentsKeys.byComment(transactionId), { sort: apiSort, order: apiOrder }]
            : publicationSlug
            ? [...commentsKeys.byPublication(publicationSlug), { sort: apiSort, order: apiOrder }]
            : ['comments', 'empty'],
        queryFn: async () => {
            if (forTransaction && transactionId) {
                // Get replies to a comment
                const result = await commentsApiV1.getCommentReplies(transactionId, {
                    sort: apiSort,
                    order: apiOrder,
                });
                // Handle PaginatedResponse structure - result is PaginatedResponse, result.data is the array
                return (result && result.data && Array.isArray(result.data)) ? result.data : [];
            } else if (publicationSlug) {
                // Get comments on a publication
                const result = await commentsApiV1.getPublicationComments(publicationSlug, {
                    sort: apiSort,
                    order: apiOrder,
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
    
    // Use quota data directly
    const freePlus = quotaData?.remainingToday || 0;
    const freeMinus = 0;

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
        hasPoints: freePlus > 0 || walletBalance > 0,
        comment,
        setComment,
        amount: Math.abs(delta),
        setAmount: setDelta,
        free: freePlus,
        // maxPlus should be the sum of quota and wallet balance (allows voting over quota using wallet)
        maxPlus: freePlus + (walletBalance || 0),
        // maxMinus should use wallet balance for negative votes (downvotes use wallet only)
        maxMinus: walletBalance || 0,
        commentAdd: async (directionPlus: boolean) => {
            try {
                // Use mutation hooks based on whether it's a comment or vote
                if (forTransaction) {
                    // This is a vote for a comment
                    const absoluteAmount = Math.abs(delta);
                    const isUpvote = directionPlus;
                    
                    // Enforce comment requirement for downvotes
                    if (!isUpvote && !comment.trim()) {
                        setError(t('reasonRequired'));
                        return;
                    }
                    
                    // Calculate vote breakdown: quota vs wallet
                    // For upvotes: use quota first, then wallet
                    // For downvotes: use wallet only (quota cannot be used for downvotes)
                    let quotaAmount = 0;
                    let walletAmount = 0;
                    
                    if (isUpvote) {
                        quotaAmount = Math.min(absoluteAmount, freePlus);
                        walletAmount = Math.max(0, absoluteAmount - freePlus);
                    } else {
                        // Downvotes use wallet only
                        walletAmount = absoluteAmount;
                    }
                    
                    // Send single API call with both quotaAmount and walletAmount
                    await voteOnVoteMutation.mutateAsync({
                        voteId: transactionId,
                        data: {
                            targetType: 'vote',
                            targetId: transactionId,
                            quotaAmount: quotaAmount > 0 ? quotaAmount : undefined,
                            walletAmount: walletAmount > 0 ? walletAmount : undefined,
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
                    // Mutations handle query invalidation automatically
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
                    // Mutations handle query invalidation automatically
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
        freePlus,
        freeMinus,
        currentPlus,
        currentMinus,
        showPlus,
        showMinus,
        showComments,
        setShowComments,
        formCommentProps,
    };
};