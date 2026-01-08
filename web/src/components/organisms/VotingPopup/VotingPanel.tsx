"use client";

import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { classList } from "@/shared/lib/classList";
import { ImageGallery } from "@/components/ui/ImageGallery";
import { useFeaturesConfig } from "@/hooks/useConfig";
import { Minus, Plus, X } from "lucide-react";
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
        if (hideQuota) {
            // In withdraw mode, use amount directly (always positive)
            setInputValue(amount.toString());
        } else {
            setInputValue(absAmount.toString());
        }
        setInputSign('');
    }, [absAmount, amount, hideQuota]);

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

    // Determine which source is active (for UI display)
    const activeSource = useMemo(() => {
        if (!isPositive) {
            // For downvotes, always use wallet
            return 'wallet';
        }
        // For upvotes, use quota if available, otherwise wallet
        if (voteBreakdown.quotaAmount > 0) {
            return 'quota';
        }
        return 'wallet';
    }, [isPositive, voteBreakdown.quotaAmount]);

    // Calculate warning messages
    const warningMessage = useMemo(() => {
        if (!isPositive) {
            // Downvotes: daily limit unavailable
            return t("warningDailyLimitUnavailableForDownvote");
        }
        // Upvotes: check various conditions
        if (quotaRemaining === 0) {
            return t("warningDailyLimitExhausted");
        }
        if (dailyQuota > walletBalance && walletBalance > 0) {
            return t("warningDailyLimitExceedsWallet");
        }
        return null;
    }, [isPositive, quotaRemaining, dailyQuota, walletBalance, t]);

    // Calculate bar sizes using sqrt-based proportional sizing
    const barSizing = useMemo(() => {
        const quotaBarWidth = Math.sqrt(Math.max(0, dailyQuota));
        const walletBarWidth = canUseWallet ? Math.sqrt(Math.max(0, walletBalance)) : 0;
        const totalWidth = quotaBarWidth + walletBarWidth;

        // Available width: 304px minus gap (11px) if wallet bar exists
        const availableWidth = 304 - (walletBarWidth > 0 ? 11 : 0);

        const quotaBarProportional = totalWidth > 0
            ? (quotaBarWidth / totalWidth) * availableWidth
            : (canUseWallet ? 0 : availableWidth);
        const walletBarProportional = totalWidth > 0
            ? (walletBarWidth / totalWidth) * availableWidth
            : 0;

        return {
            quotaBarWidth: quotaBarProportional,
            walletBarWidth: walletBarProportional,
        };
    }, [dailyQuota, walletBalance, canUseWallet]);

    // Handle input change for text input (voting mode)
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

    // Handle input change for number input (withdraw mode)
    const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        
        // Allow empty input - reset to 0
        if (value === '' || value === null || value === undefined) {
            setInputValue('');
            setAmount(0);
            return;
        }
        
        // Parse number
        const numValue = Number(value);
        
        // Handle NaN or invalid values
        if (isNaN(numValue)) {
            setInputValue('');
            setAmount(0);
            return;
        }
        
        // Clamp to valid range [0, maxPlus]
        const clampedValue = Math.max(0, Math.min(maxPlus, numValue));
        setAmount(clampedValue);
        setInputValue(clampedValue.toString());
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
        // For number input (withdraw mode), ensure value is set
        if (hideQuota) {
            setInputValue(amount.toString());
        } else {
            setInputValue(absAmount.toString());
        }
    };

    // Button handlers
    const handleDecrease = () => {
        // In withdraw mode (hideQuota), only allow positive values
        if (hideQuota) {
            const newAmount = Math.max(0, amount - 1);
            setAmount(newAmount);
            setInputValue(newAmount.toString());
            return;
        }
        
        const newAmount = amount - 1;
        
        // If going negative, check wallet balance (downvotes require wallet merits)
        if (newAmount < 0 && walletBalance === 0) {
            // Can't go negative without wallet balance, but allow decreasing positive values to 0
            if (amount > 0) {
                setAmount(0);
                setInputValue('0');
                setInputSign('');
            }
            return;
        }
        
        // Calculate limits
        // For positive values, minimum is 0
        // For negative values, minimum is -maxMinus (if set) or -walletBalance
        const minLimit = newAmount < 0 
            ? (maxMinus > 0 ? -maxMinus : -walletBalance)
            : 0;
        
        const clampedAmount = Math.max(minLimit, newAmount);
        setAmount(clampedAmount);
        setInputValue(Math.abs(clampedAmount).toString());
        setInputSign(clampedAmount < 0 ? '-' : '');
    };

    const handleIncrease = () => {
        const newAmount = amount + 1;
        
        // In withdraw mode (hideQuota), use maxPlus as limit
        if (hideQuota) {
            const clampedAmount = Math.min(maxPlus, newAmount);
            setAmount(clampedAmount);
            setInputValue(clampedAmount.toString());
            return;
        }
        
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
                "w-full max-w-[400px] bg-base-100 flex flex-col gap-4 shadow-xl overflow-y-auto border border-base-300/50",
                inline
                    ? "rounded-xl mx-auto relative"
                    : "rounded-xl max-h-[90vh]"
            )}
            style={{ padding: "20px" }}
        >
            {/* Close button */}
            {!inline && (
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-base-content/50 hover:text-base-content rounded-full hover:bg-base-content/5 transition-colors z-10"
                    aria-label={tShared("close") || "Close"}
                >
                    <X size={20} />
                </button>
            )}
            
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-base-content">
                    {title || t("voteTitle")}
                </h2>
                {/* Explanation - keep the mechanics hint */}
                {!hideQuota && (
                    <p className="text-xs text-base-content/50 leading-relaxed whitespace-pre-line">
                        {t("votingMechanics")}
                    </p>
                )}
            </div>


            {/* Voting Section */}
            {!hideQuota && (
                <div className="flex flex-col gap-4">
                    {/* Progress Bars - Show vote distribution */}
                    <div className="flex gap-2">
                        {/* Daily Quota Progress Bar */}
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="text-sm font-medium text-base-content">
                                {t("dailyQuotaLabel")}
                            </div>
                            <div className="relative h-12 bg-base-200 rounded-lg border-2 border-base-300 overflow-hidden">
                                {/* Progress fill - shows how much of quota will be used */}
                                {isPositive && absAmount > 0 && (
                                    <div
                                        className="absolute left-0 top-0 bottom-0 transition-all bg-primary"
                                        style={{
                                            width: `${Math.min(100, (voteBreakdown.quotaAmount / Math.max(1, dailyQuota || quotaRemaining + usedToday)) * 100)}%`,
                                        }}
                                    />
                                )}
                                {/* Available text overlay */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className={classList(
                                        "text-xs font-medium z-10",
                                        isPositive && absAmount > 0 && voteBreakdown.quotaAmount > 0
                                            ? "text-white drop-shadow-sm"
                                            : "text-base-content/70"
                                    )}>
                                        {t("available")} {quotaRemaining}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Wallet Progress Bar */}
                        {canUseWallet && (
                            <div className="flex-1 flex flex-col gap-2">
                                <div className="text-sm font-medium text-base-content">
                                    {t("walletLabel")}
                                </div>
                                <div className="relative h-12 bg-base-200 rounded-lg border-2 border-base-300 overflow-hidden">
                                    {/* Progress fill - shows how much of wallet will be used */}
                                    {/* For upvotes: only fill when quota is fully used */}
                                    {/* For downvotes: always fill */}
                                    {absAmount > 0 && voteBreakdown.walletAmount > 0 && (
                                        <div
                                            className="absolute left-0 top-0 bottom-0 transition-all bg-primary"
                                            style={{
                                                width: `${Math.min(100, (voteBreakdown.walletAmount / Math.max(1, walletBalance)) * 100)}%`,
                                            }}
                                        />
                                    )}
                                    {/* Available text overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className={classList(
                                            "text-xs font-medium z-10",
                                            absAmount > 0 && voteBreakdown.walletAmount > 0
                                                ? "text-white drop-shadow-sm"
                                                : "text-base-content/70"
                                        )}>
                                            {t("available")} {walletBalance}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Amount Input Section */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            {/* Decrease Button */}
                            <Button
                                onClick={handleDecrease}
                                disabled={
                                    // Disable if:
                                    // 1. Amount is 0 and no wallet balance (can't go negative)
                                    // 2. Amount is negative and already at minimum (-maxMinus or -walletBalance)
                                    (amount === 0 && walletBalance === 0) ||
                                    (amount < 0 && maxMinus > 0 && amount <= -maxMinus) ||
                                    (amount < 0 && maxMinus === 0 && amount <= -walletBalance)
                                }
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

                </div>
            )}

            {/* Withdraw Progress Bar (when hideQuota is true) */}
            {hideQuota && (
                <div className="flex flex-col gap-4">
                    {/* Hint text */}
                    <p className="text-xs text-base-content/60 leading-relaxed">
                        {tShared("withdrawHint")}
                    </p>

                    {/* Amount input with buttons */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleDecrease}
                                disabled={amount <= 0}
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 shrink-0 border-base-300 hover:bg-base-200 hover:border-base-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Minus className="h-5 w-5" />
                            </Button>

                            <div className="flex-1">
                                <Input
                                    type="number"
                                    value={inputValue || ''}
                                    onChange={handleNumberInputChange}
                                    onFocus={handleInputFocus}
                                    onBlur={handleInputBlur}
                                    className={classList(
                                        "h-12 text-center text-lg font-semibold rounded-xl border-base-300 focus:border-base-content/50",
                                        "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]",
                                        amount > 0 ? "text-base-content" : "text-base-content/50"
                                    )}
                                    min={0}
                                    max={maxPlus}
                                    placeholder="0"
                                />
                            </div>

                            <Button
                                onClick={handleIncrease}
                                disabled={absAmount >= maxPlus}
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 shrink-0 border-base-300 hover:bg-base-200 hover:border-base-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Available Progress Bar */}
                    <div className="flex flex-col gap-2">
                        <div className="relative h-12 bg-base-200 rounded-lg border-2 border-base-300 overflow-hidden">
                            {/* Progress fill - shows how much is available */}
                            {(() => {
                                const available = Math.max(0, maxPlus - amount);
                                const fillPercent = maxPlus > 0 ? Math.min(100, (available / maxPlus) * 100) : 0;
                                // Always show fill if there's any available amount
                                if (available > 0 && fillPercent > 0) {
                                    return (
                                        <div
                                            className="absolute left-0 top-0 bottom-0 transition-all bg-primary"
                                            style={{
                                                width: `${fillPercent}%`,
                                            }}
                                        />
                                    );
                                }
                                return null;
                            })()}
                            {/* Available text overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                {(() => {
                                    const available = Math.max(0, maxPlus - amount);
                                    const fillPercent = maxPlus > 0 ? Math.min(100, (available / maxPlus) * 100) : 0;
                                    const hasFill = available > 0 && fillPercent > 0;
                                    return (
                                        <span className={classList(
                                            "text-xs font-medium z-10",
                                            hasFill
                                                ? "text-white drop-shadow-sm"
                                                : "text-base-content/70"
                                        )}>
                                            {tShared("available")} {available}
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Comment Input - Required */}
            {!hideComment && (
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-base-content">
                        {t("comment")}
                    </label>
                    <p className="text-xs text-base-content/60 mb-2">
                        {t("explanationPlaceholder")}
                    </p>
                    <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t("textField")}
                        className={classList(
                            "min-h-[100px] resize-none",
                            !comment.trim() ? "border-error/50 focus:border-error" : ""
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
                        "w-full h-10 px-4 text-sm font-medium rounded-lg transition-all active:scale-95 shadow-sm",
                        isButtonDisabled
                            ? "bg-base-200 text-base-content/50 cursor-not-allowed border border-base-300"
                            : "bg-base-content text-base-100 hover:bg-base-content/90 border border-base-content/20"
                    )}
                >
                    {hideQuota ? tShared("withdrawButton") : t("giveVote")}
                </button>
                {/* Server error (if any) */}
                {error && (
                    <div className="text-error text-sm text-center bg-error/10 rounded-lg p-2 border border-error/20">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};
