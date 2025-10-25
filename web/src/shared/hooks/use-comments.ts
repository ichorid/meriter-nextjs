import { useState } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { commentsApiV1, thanksApiV1, usersApiV1 } from '@/lib/api/v1';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
const { round } = Math;

export const useComments = (
    forTransaction: boolean,
    publicationSlug: string,
    transactionId: string,
    getCommentsApiPath: string,
    getFreeBalanceApiPath: string,
    balance: any,
    updBalance: any,
    plusGiven: number,
    minusGiven: number,
    activeCommentHook: any,
    onlyPublication = false
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
    const { data: free = {} } = useQuery({
        queryKey: ['quota', user?.id],
        queryFn: async () => {
            if (!user?.id) return { plus: 0, minus: 0 };
            const quota = await usersApiV1.getUserQuota(user.id);
            return { plus: quota || 0, minus: 0 }; // Simplified
        },
        refetchOnWindowFocus: false,
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
                // Use appropriate v1 endpoint based on whether it's a comment or thank
                if (forTransaction) {
                    // This is a thank for a comment
                    const response = await apiClient.post(`/api/v1/comments/${transactionId}/thanks`, {
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
            } catch (err: any) {
                setError(err.message || t('errorCommenting'));
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