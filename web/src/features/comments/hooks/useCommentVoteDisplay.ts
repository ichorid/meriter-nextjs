import { useMemo } from 'react';

export interface UseCommentVoteDisplayOptions {
    amountTotal?: number;
    hasVoteTransactionData: boolean;
    displaySum: number;
    commentUpvotes: number;
    commentDownvotes: number;
    directionPlus?: boolean;
    optimisticSum?: number;
    withdrawableBalance: number;
}

export interface CommentVoteDisplay {
    rate: string;
    voteType: 'upvote-quota' | 'upvote-wallet' | 'upvote-mixed' | 'downvote-quota' | 'downvote-wallet' | 'downvote-mixed';
    amountFree: number;
    amountWallet: number;
    displayUpvotes: number;
    displayDownvotes: number;
}

export function useCommentVoteDisplay({
    amountTotal,
    hasVoteTransactionData,
    displaySum,
    commentUpvotes,
    commentDownvotes,
    directionPlus,
    optimisticSum,
    withdrawableBalance,
}: UseCommentVoteDisplayOptions): CommentVoteDisplay {
    // Calculate direction
    const calculatedDirectionPlus = directionPlus ?? 
        (amountTotal !== undefined ? (amountTotal > 0 || commentUpvotes > 0) : 
         ((commentUpvotes > commentDownvotes) || (displaySum > 0)));
    
    // Always display comment's accumulated upvotes/downvotes
    const displayUpvotes = commentUpvotes;
    const displayDownvotes = commentDownvotes;
    
    // Format the rate
    const rate = useMemo(() => {
        if (!hasVoteTransactionData || amountTotal === undefined) {
            const score = displaySum;
            if (score === 0) return "0";
            const sign = score > 0 ? "+" : "-";
            return `${sign} ${Math.abs(score)}`;
        }
        const amount = Math.abs(amountTotal);
        const sign = calculatedDirectionPlus ? "+" : "-";
        return `${sign} ${amount}`;
    }, [hasVoteTransactionData, amountTotal, displaySum, calculatedDirectionPlus]);
    
    // Determine vote type
    const voteType = useMemo(() => {
        const withdrawableAmount = optimisticSum ?? withdrawableBalance;
        const amountFree = Math.abs(amountTotal || 0) - Math.abs(withdrawableAmount || 0);
        const amountWallet = Math.abs(withdrawableAmount || 0);
        
        const isQuota = amountFree > 0;
        const isWallet = amountWallet > 0;
        
        if (calculatedDirectionPlus) {
            if (isQuota && isWallet) return 'upvote-mixed';
            return isQuota ? 'upvote-quota' : 'upvote-wallet';
        } else {
            if (isQuota && isWallet) return 'downvote-mixed';
            return isQuota ? 'downvote-quota' : 'downvote-wallet';
        }
    }, [amountTotal, optimisticSum, withdrawableBalance, calculatedDirectionPlus]);

    const amountFree = useMemo(() => {
        if (!hasVoteTransactionData || amountTotal === undefined) return 0;
        return Math.abs(amountTotal) - Math.abs((optimisticSum ?? withdrawableBalance) || 0);
    }, [hasVoteTransactionData, amountTotal, optimisticSum, withdrawableBalance]);

    const amountWallet = useMemo(() => {
        return Math.abs((optimisticSum ?? withdrawableBalance) || 0);
    }, [optimisticSum, withdrawableBalance]);

    return {
        rate,
        voteType,
        amountFree,
        amountWallet,
        displayUpvotes,
        displayDownvotes,
    };
}

