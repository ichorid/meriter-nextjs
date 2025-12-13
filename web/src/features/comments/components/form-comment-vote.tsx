"use client";

import { FormCommentVoteBase } from "./form-comment-vote-base";

interface iFormCommentVoteProps {
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
}

export const FormCommentVote = (props: iFormCommentVoteProps) => {
    return <FormCommentVoteBase {...props} />;
};
