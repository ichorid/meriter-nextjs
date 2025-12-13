"use client";

import { memo } from "react";
import { FormCommentVoteBase } from "./form-comment-vote-base";

interface iFormCommentVoteVerticalProps {
    comment: string;
    setComment: (value: string) => void;
    freePlus: number;
    freeMinus: number;
    amount: number;
    setAmount: (amount: number) => void;
    maxPlus: number;
    maxMinus: number;
    commentAdd: (data: any) => void;
    error: string;
    reason?: string;
    isWithdrawMode?: boolean;
    quotaAmount?: number;
    walletAmount?: number;
    quotaRemaining?: number;
    currencyIconUrl?: string;
}

export const FormCommentVoteVertical = memo(
    (props: iFormCommentVoteVerticalProps) => {
        return <FormCommentVoteBase {...props} />;
    }
);

FormCommentVoteVertical.displayName = "FormCommentVoteVertical";
