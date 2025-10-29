import { useState } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { commentsApiV1, votesApiV1, usersApiV1 } from '@/lib/api/v1';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import type { Dispatch, SetStateAction } from 'react';

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
    getCommentsApiPath: string,
    getFreeBalanceApiPath: string,
    balance: Wallet | null,
    updBalance: () => Promise<void>,
    plusGiven: number,
    minusGiven: number,
    activeCommentHook: [string | null, Dispatch<SetStateAction<string | null>>],
    onlyPublication = false,
    communityId?: string
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

    // Get comments using v1 API
    const { data: comments = [] } = useQuery({
        queryKey: ['comments', forTransaction ? transactionId : publicationSlug],
        queryFn: async () => {
            if (forTransaction && transactionId) {
                // Get replies to a comment
                const result = await commentsApiV1.getCommentReplies(transactionId);
                return result.data || [];
            } else if (publicationSlug) {
                // Get comments on a publication
                const result = await commentsApiV1.getPublicationComments(publicationSlug);
                return result.data || [];
            }
            return [];
        },
        refetchOnWindowFocus: false,
    });

    // Get user quota for free balance
    const { user } = useAuth();
    const { data: free = { plus: 0, minus: 0 } } = useQuery({
        queryKey: ['quota', user?.id, communityId],
        queryFn: async () => {
            if (!user?.id || !communityId) return { plus: 0, minus: 0 };
            try {
                const quota = await usersApiV1.getUserQuota(user.id, communityId);
                return { plus: quota?.remainingToday || 0, minus: 0 }; // Use remainingToday from quota object
            } catch (error) {
                // Quota not configured - return 0
                return { plus: 0, minus: 0 };
            }
        },
        refetchOnWindowFocus: false,
        enabled: !!communityId, // Only fetch when communityId is available
        retry: false, // Don't retry on quota errors
    });

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

    const formCommentProps = {
        uid,
        hasPoints: (free?.plus || 0) > 0,
        comment,
        setComment,
        amount: Math.abs(delta),
        setAmount: setDelta,
        free: free?.plus || 0,
        maxPlus: free?.plus || 0,
        maxMinus: free?.minus || 0,
        commentAdd: async (directionPlus: boolean) => {
            try {
                // Use appropriate v1 endpoint based on whether it's a comment or vote
                if (forTransaction) {
                    // This is a vote for a comment
                    const response = await apiClient.post(`/api/v1/comments/${transactionId}/votes`, {
                        amount: directionPlus ? Math.abs(delta) : -Math.abs(delta),
                        sourceType: 'personal',
                        comment: comment.trim() ? { content: comment.trim() } : undefined,
                    });
                    if (response.success) {
                        setComment("");
                        setDelta(0);
                        setError("");
                        updBalance();
                        if (activeCommentHook) {
                            activeCommentHook[1](null);
                        }
                    }
                } else {
                    // This is a comment on a publication
                    const response = await apiClient.post("/api/v1/comments", {
                        targetType: 'publication',
                        targetId: publicationSlug,
                        content: comment.trim(),
                    });
                    if (response.success) {
                        setComment("");
                        setDelta(0);
                        setError("");
                        updBalance();
                        if (activeCommentHook) {
                            activeCommentHook[1](null);
                        }
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