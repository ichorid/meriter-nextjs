// CommentForm molecule component - wrapper around VotingPanel
"use client";

import React, { useState, useEffect } from "react";
import { VotingPanel } from "@/components/organisms/VotingPopup/VotingPanel";

interface CommentFormProps {
    onSubmit: (comment: string, amount: number, directionPlus: boolean) => void;
    onCancel: () => void;
    maxAmount: number;
    initialAmount?: number;
    initialDirection?: boolean;
    loading?: boolean;
    className?: string;
}

export const CommentForm: React.FC<CommentFormProps> = ({
    onSubmit,
    onCancel,
    maxAmount,
    initialAmount = 0,
    initialDirection = true,
    loading = false,
    className = "",
}) => {
    const [comment, setComment] = useState("");
    const [amount, setAmount] = useState(initialAmount);

    // Reset when initialAmount changes
    useEffect(() => {
        setAmount(initialAmount);
    }, [initialAmount]);

    const handleSubmit = (directionPlus: boolean) => {
        if (amount === 0) return;
        onSubmit(comment, Math.abs(amount), directionPlus);
    };

    // Calculate maxPlus and maxMinus from maxAmount
    const maxPlus = maxAmount;
    const maxMinus = maxAmount;

    return (
        <div className={className}>
            <VotingPanel
                onClose={onCancel}
                amount={amount}
                setAmount={setAmount}
                comment={comment}
                setComment={setComment}
                onSubmit={handleSubmit}
                maxPlus={maxPlus}
                maxMinus={maxMinus}
                quotaRemaining={maxAmount}
                dailyQuota={maxAmount}
                usedToday={0}
                error={loading ? "Submitting..." : undefined}
                inline={true}
            />
        </div>
    );
};

CommentForm.displayName = "CommentForm";
