"use client";

import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { classList } from "@/shared/lib/classList";
import { ImageGallery } from "@/components/ui/ImageGallery";
import { useFeaturesConfig } from "@/hooks/useConfig";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/shadcn/button";
import { Textarea } from "@/components/ui/shadcn/textarea";
import { Input } from "@/components/ui/shadcn/input";
import type { Community } from "@meriter/shared-types";
import { canUseWalletForVoting } from "./voting-utils";

interface VotingPanelProps {
    onClose: () => void;
    amount: number;
    setAmount: (val: number) => void;
    comment: string;
    setComment: (val: string) => void;
    onSubmit: (directionPlus: boolean) => void;
    maxPlus: number;
    maxMinus: number;
    quotaRemaining: number;
    dailyQuota: number;
    usedToday: number;
    walletBalance?: number;
    community?: Community | null;
    error?: string;
    isViewer?: boolean;
    inline?: boolean;
    images?: string[];
    onImagesChange?: (images: string[]) => void;
    // Withdraw mode props
    hideComment?: boolean;
    hideQuota?: boolean;
    hideDirectionToggle?: boolean;
    hideImages?: boolean;
    title?: string;
    onSubmitSimple?: () => void;
}

export const VotingPanel: React.FC<VotingPanelProps> = ({
    onClose,
    amount,
    setAmount,
    comment,
    setComment,
    onSubmit,
    maxPlus,
    maxMinus,
    quotaRemaining,
    dailyQuota,
    usedToday,
    walletBalance = 0,
    community,
    error,
    isViewer = false,
    inline = false,
    images = [],
    onImagesChange,
    hideComment = false,
    hideQuota = false,
    hideDirectionToggle = false,
    hideImages = false,
    title,
    onSubmitSimple,
}) => {
    const t = useTranslations("comments");
    const tShared = useTranslations("shared");
    const features = useFeaturesConfig();
    const enableCommentImageUploads = features.commentImageUploads;

    // Direction is determined by the sign of amount
    const isPositive = amount >= 0;
    const absAmount = Math.abs(amount);
    const [inputValue, setInputValue] = useState(absAmount.toString());
    const [inputSign, setInputSign] = useState<'+' | '-' | ''>('');

    // Sync inputValue when amount changes externally
    React.useEffect(() => {
        setInputValue(absAmount.toString());
        setInputSign('');
    }, [absAmount]);

    // Check if wallet can be used for voting
    const canUseWallet = useMemo(() => {
        return canUseWalletForVoting(walletBalance, community);
    }, [walletBalance, community]);

    // Calculate maximum available merits
    // For upvotes: quota + wallet
    // For downvotes: wallet only (quota cannot be used for downvotes)
    const maxAvailableMerits = useMemo(() => {
        if (!isPositive) {
            return walletBalance; // Downvotes use wallet only
        }
        return quotaRemaining + walletBalance; // Upvotes use quota first, then wallet
    }, [isPositive, quotaRemaining, walletBalance]);

    // Calculate vote breakdown: quota vs wallet
    const voteBreakdown = useMemo(() => {
        const voteAmount = absAmount;
        if (!isPositive) {
            // Downvotes use wallet only (quota cannot be used for downvotes)
            return {
                quotaAmount: 0,
                walletAmount: voteAmount,
                quotaBefore: quotaRemaining,
                quotaAfter: quotaRemaining,
                walletBefore: walletBalance,
                walletAfter: Math.max(0, walletBalance - voteAmount),
            };
        }

        // Upvotes: use quota first, then wallet
        const quotaAmount = Math.min(voteAmount, quotaRemaining);
        const walletAmount = Math.max(0, voteAmount - quotaRemaining);
        return {
            quotaAmount,
            walletAmount,
            quotaBefore: quotaRemaining,
            quotaAfter: Math.max(0, quotaRemaining - quotaAmount),
            walletBefore: walletBalance,
            walletAfter: Math.max(0, walletBalance - walletAmount),
        };
    }, [absAmount, isPositive, quotaRemaining, walletBalance]);

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        
        // Allow empty input - reset to 0
        if (value === '') {
            setInputValue('');
            setInputSign('');
            setAmount(0);
            return;
        }
        
        // Remove leading + or - to get numeric part
        const cleanValue = value.replace(/^[+-]/, '');
        const hasSign = /^[+-]/.test(value);
        const isNegative = value.startsWith('-');
        
        // Allow just plus sign while typing
        if (value === '+') {
            setInputValue('');
            setInputSign(value);
            setAmount(0);
            return;
        }
        // Block minus sign if no wallet balance (downvotes require wallet merits)
        if (value === '-') {
            if (walletBalance === 0) {
                setInputValue('');
                setInputSign('');
                setAmount(0);
                return;
            }
            setInputValue('');
            setInputSign(value);
            setAmount(0);
            return;
        }
        
        // If sign + 0 or sign + empty, reset to 0
        if (value === '-0' || value === '+0' || (hasSign && (cleanValue === '0' || cleanValue === ''))) {
            setInputValue('');
            setInputSign('');
            setAmount(0);
            return;
        }
        
        // Parse number (handles negative values correctly)
        const numValue = Number(value);
        if (!isNaN(numValue) && cleanValue !== '' && cleanValue !== '0') {
            // Block negative values if no wallet balance (downvotes require wallet merits)
            if (numValue < 0 && walletBalance === 0) {
                setInputValue('');
                setInputSign('');
                setAmount(0);
                return;
            }
            // Clamp to available merits (quota + wallet)
            // For upvotes, use maxAvailableMerits (quota + wallet)
            // For downvotes, use wallet only
            const maxByMerits = isPositive ? maxAvailableMerits : walletBalance;
            const minByMerits = -maxAvailableMerits;
            
            // Also respect maxPlus and maxMinus if set (but maxAvailableMerits takes priority for upvotes)
            const maxLimit = isPositive 
                ? maxAvailableMerits // For upvotes, always use maxAvailableMerits (quota + wallet)
                : (maxMinus > 0 ? Math.min(maxMinus, maxByMerits) : maxByMerits);
            const minLimit = maxMinus > 0 ? Math.max(-maxMinus, minByMerits) : minByMerits;
            
            const clampedValue = Math.max(minLimit, Math.min(maxLimit, numValue));
            setAmount(clampedValue);
            // Update input value to absolute value for internal storage
            setInputValue(Math.abs(clampedValue).toString());
            setInputSign('');
        } else if (cleanValue !== '') {
            // If there are digits but not a complete number yet, allow typing
            const numericMatch = cleanValue.match(/^\d*/);
            if (numericMatch && numericMatch[0] !== '') {
                // Block negative values if no wallet balance (downvotes require wallet merits)
                if (isNegative && walletBalance === 0) {
                    setInputValue('');
                    setInputSign('');
                    setAmount(0);
                    return;
                }
                // Store the numeric part and sign
                setInputValue(numericMatch[0]);
                setInputSign(isNegative ? '-' : '+');
                // Try to parse what we have so far
                const partialValue = isNegative ? -Number(numericMatch[0]) : Number(numericMatch[0]);
                if (!isNaN(partialValue)) {
                    // For upvotes, use maxAvailableMerits (quota + wallet)
                    // For downvotes, use wallet only
                    const maxByMerits = isPositive ? maxAvailableMerits : walletBalance;
                    const minByMerits = -maxAvailableMerits;
                    const maxLimit = isPositive 
                        ? maxAvailableMerits // For upvotes, always use maxAvailableMerits (quota + wallet)
                        : (maxMinus > 0 ? Math.min(maxMinus, maxByMerits) : maxByMerits);
                    const minLimit = maxMinus > 0 ? Math.max(-maxMinus, minByMerits) : minByMerits;
                    const clampedValue = Math.max(minLimit, Math.min(maxLimit, partialValue));
                    setAmount(clampedValue);
                }
            }
        }
    };

    // Handle input focus - clear if zero
    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (absAmount === 0) {
            setInputValue('');
            setInputSign('');
            e.target.select();
        }
    };

    // Handle input blur - sync with amount
    const handleInputBlur = () => {
        setInputValue(absAmount.toString());
    };

    // Button handlers
    const handleDecrease = () => {
        // Can't decrease if no wallet balance (downvotes require wallet merits)
        if (walletBalance === 0) {
            return;
        }
        const newAmount = amount - 1;
        const maxByMerits = -maxAvailableMerits;
        const minLimit = maxMinus > 0 ? Math.max(-maxMinus, maxByMerits) : maxByMerits;
        const clampedAmount = Math.max(minLimit, newAmount);
        setAmount(clampedAmount);
        setInputValue(Math.abs(clampedAmount).toString());
    };

    const handleIncrease = () => {
        const newAmount = amount + 1;
        // For upvotes, always use maxAvailableMerits (quota + wallet)
        const maxLimit = isPositive ? maxAvailableMerits : (maxPlus > 0 ? maxPlus : maxAvailableMerits);
        const clampedAmount = Math.min(maxLimit, newAmount);
        setAmount(clampedAmount);
        setInputValue(Math.abs(clampedAmount).toString());
    };

    // Calculate if button should be disabled
    // Comment is required for all votes (both positive and negative)
    const isButtonDisabled = absAmount === 0 || (!hideComment && !comment.trim());

    return (
        <div
            className={classList(
                "w-full max-w-[400px] bg-base-100 flex flex-col gap-4 shadow-xl overflow-y-auto",
                inline
                    ? "rounded-xl mx-auto"
                    : "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-xl z-50 max-h-[90vh]"
            )}
            style={{ padding: "20px" }}
        >
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-base-content">
                    {title || t("voteTitle")}
                </h2>
                {/* Explanation */}
                {!hideQuota && (
                    <p className="text-xs text-base-content/50 leading-relaxed whitespace-pre-line">
                        {t("votingMechanics")}
                    </p>
                )}
            </div>

            {/* Voting Section */}
            {!hideQuota && (
                <div className="flex flex-col gap-4">
                    {/* Amount Input Section */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            {/* Decrease Button */}
                            <Button
                                onClick={handleDecrease}
                                disabled={maxMinus > 0 && amount <= -maxMinus}
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 shrink-0"
                            >
                                <Minus className="h-5 w-5" />
                            </Button>

                            {/* Amount Input */}
                            <div className="flex-1 relative">
                                <Input
                                    type="text"
                                    value={inputSign ? `${inputSign}${inputValue}` : (amount !== 0 ? `${amount < 0 ? "-" : "+"}${inputValue || "0"}` : inputValue || "")}
                                    onChange={handleInputChange}
                                    onFocus={handleInputFocus}
                                    onBlur={handleInputBlur}
                                    className={classList(
                                        "h-12 text-center text-lg font-semibold px-3",
                                        "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]",
                                        isPositive && amount > 0 ? "text-success" : "",
                                        !isPositive && amount < 0 ? "text-error" : ""
                                    )}
                                    placeholder="0"
                                />
                            </div>

                            {/* Increase Button */}
                            <Button
                                onClick={handleIncrease}
                                disabled={isPositive ? absAmount >= maxAvailableMerits : absAmount >= maxPlus}
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 shrink-0"
                            >
                                <Plus className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Merit Balance Display - Combined */}
                    <div className="bg-base-200/50 rounded-lg p-2.5 space-y-2">
                        {/* Quota Display */}
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-base-content/50 font-medium">
                                {t("dailyQuota")}
                            </span>
                            <span className="text-base-content/70 font-semibold tabular-nums">
                                {voteBreakdown.quotaBefore} → {voteBreakdown.quotaAfter}
                            </span>
                        </div>
                        {absAmount > 0 && voteBreakdown.quotaAmount > 0 && (
                            <div className={`text-[10px] ml-auto ${isPositive ? "text-success/80" : "text-error/80"}`}>
                                -{voteBreakdown.quotaAmount} из квоты
                            </div>
                        )}

                        {/* Wallet Display */}
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-base-content/50 font-medium">
                                {t("walletBalance")}
                            </span>
                            <span className="text-base-content/70 font-semibold tabular-nums">
                                {voteBreakdown.walletBefore} → {voteBreakdown.walletAfter}
                            </span>
                        </div>
                        {absAmount > 0 && voteBreakdown.walletAmount > 0 && (
                            <div className={`text-[10px] ml-auto ${isPositive ? "text-success/80" : "text-error/80"}`}>
                                -{voteBreakdown.walletAmount} из накопленных
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Withdraw Progress Bar (when hideQuota is true) */}
            {hideQuota && (
                <div className="flex flex-col gap-4">
                    <div className="bg-base-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-base-content/70">
                                {t("available")}
                            </span>
                            <span className="text-sm font-semibold text-base-content">
                                {maxPlus}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleDecrease}
                            disabled={amount <= 0 || walletBalance === 0}
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 shrink-0"
                        >
                            <Minus className="h-5 w-5" />
                        </Button>

                        <div className="flex-1 relative">
                            <Input
                                type="number"
                                value={inputValue}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                className="h-12 text-center text-lg font-semibold"
                                min={0}
                                max={maxPlus}
                                placeholder="0"
                            />
                        </div>

                        <Button
                            onClick={handleIncrease}
                            disabled={isPositive ? absAmount >= maxAvailableMerits : absAmount >= maxPlus}
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 shrink-0"
                        >
                            <Plus className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Comment Input - Required */}
            {!hideComment && (
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-base-content flex items-center gap-2">
                        <span>{t("comment")}</span>
                        <span className="text-xs text-base-content/50 font-normal">
                            {t("required")}
                        </span>
                    </label>
                    <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t("textField")}
                        className={classList(
                            "min-h-[100px] resize-none",
                            !comment.trim() && "border-error/50 focus:border-error"
                        )}
                        required
                    />
                    {!comment.trim() && (
                        <p className="text-xs text-error">
                            {t("commentRequired")}
                        </p>
                    )}
                </div>
            )}

            {/* Image Gallery */}
            {onImagesChange && !hideImages && enableCommentImageUploads && (
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-base-content">
                        {t("images")}
                    </label>
                    <ImageGallery
                        images={images}
                        onImagesChange={onImagesChange}
                        disabled={isViewer}
                        className="w-full"
                    />
                </div>
            )}

            {/* Submit Button */}
            <div className="flex flex-col gap-2 pt-2">
                <button
                    onClick={() => {
                        if (onSubmitSimple) {
                            onSubmitSimple();
                        } else {
                            onSubmit(isPositive);
                        }
                    }}
                    disabled={isButtonDisabled}
                    className={classList(
                        "w-full h-8 px-4 text-xs font-medium rounded-lg transition-all active:scale-95",
                        isButtonDisabled
                            ? "bg-gray-200 dark:bg-gray-700 text-base-content/60 cursor-not-allowed"
                            : "bg-base-content text-base-100 hover:bg-base-content/90"
                    )}
                >
                    {t("submit")}
                </button>
                {/* Server error (if any) */}
                {error && (
                    <div className="text-error text-sm text-center bg-error/10 rounded-lg p-2">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};
