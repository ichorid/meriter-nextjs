import { useMemo } from 'react';

export interface UseCommentWithdrawalOptions {
    isAuthor: boolean;
    withdrawableBalance: number;
    currentBalance: number;
}

export interface CommentWithdrawal {
    maxWithdrawAmount: number;
    maxTopUpAmount: number;
}

export function useCommentWithdrawal({
    isAuthor,
    withdrawableBalance,
    currentBalance,
}: UseCommentWithdrawalOptions): CommentWithdrawal {
    return useMemo(() => {
        const maxWithdrawAmount = isAuthor
            ? Math.floor(10 * withdrawableBalance) / 10
            : 0;
        
        const maxTopUpAmount = isAuthor
            ? Math.floor(10 * currentBalance) / 10
            : 0;

        return {
            maxWithdrawAmount,
            maxTopUpAmount,
        };
    }, [isAuthor, withdrawableBalance, currentBalance]);
}

