import { useState } from "react";
import { useQuery } from '@tanstack/react-query';
import { commentsApiV1 } from '@/lib/api/v1';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import type { Dispatch, SetStateAction } from 'react';
import { commentsKeys } from '@/hooks/api/useComments';
import { useUserQuota } from '@/hooks/api/useQuota';
import { useFeaturesConfig } from '@/hooks/useConfig';

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
    const uid = transactionId || publicationSlug;
    const [showComments, setShowComments] = useState(!!onlyPublication);

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

    const currentPlus = round(plusGiven || 0);
    const currentMinus = round(minusGiven || 0);

    const showPlus = () => {
        setShowComments(true);
        if (activeCommentHook) {
            activeCommentHook[1](uid);
        }
    };
    const showMinus = () => {
        setShowComments(true);
        if (activeCommentHook) {
            activeCommentHook[1](uid);
        }
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
    };
};