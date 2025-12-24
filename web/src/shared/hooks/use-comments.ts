import { useState } from "react";
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Dispatch, SetStateAction } from 'react';
import { _commentsKeys } from '@/hooks/api/useComments';
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
    const uid = transactionId || publicationSlug;
    const [showComments, setShowComments] = useState(!!onlyPublication);

    // Map sort preference to API parameters
    const apiSort = sortBy === 'voted' ? 'score' : 'createdAt';
    const apiOrder = 'desc'; // Always descending for both recent and voted

    // Get comments using tRPC
    const repliesQuery = trpc.comments.getReplies.useQuery(
        {
            id: transactionId || '',
            sort: apiSort,
            order: apiOrder as 'asc' | 'desc',
        },
        {
            enabled: forTransaction && showComments && !!transactionId,
            refetchOnWindowFocus: false,
        },
    );

    const publicationCommentsQuery = trpc.comments.getByPublicationId.useQuery(
        {
            publicationId: publicationSlug || '',
            sort: apiSort,
            order: apiOrder as 'asc' | 'desc',
        },
        {
            enabled: !forTransaction && !!publicationSlug,
            refetchOnWindowFocus: false,
        },
    );

    // Use the appropriate query result
    const comments = forTransaction && transactionId
        ? (repliesQuery.data?.data || [])
        : publicationSlug
        ? (publicationCommentsQuery.data?.data || [])
        : [];

    // Get user quota for free balance using standardized hook
    const { _user } = useAuth();
    const { data: quotaData } = useUserQuota(communityId);
    
    // Use quota data directly
    const freePlus = quotaData?.remainingToday || 0;
    const freeMinus = 0;
    const _dailyQuota = quotaData?.dailyQuota || 0;
    const _usedToday = quotaData?.usedToday || 0;
    const _quotaRemaining = freePlus;

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