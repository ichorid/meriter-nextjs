"use client";

import React, { useMemo } from "react";
import { useTranslations } from "next-intl";
import { classList } from "@/shared/lib/classList";
import { ImageGallery } from "@/components/ui/ImageGallery";
import { useFeaturesConfig } from "@/hooks/useConfig";
import { Icon } from "@/components/atoms/Icon/Icon";
import { Button } from "@/components/ui/shadcn/button";
import { Textarea } from "@/components/ui/shadcn/textarea";
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

    // Check if wallet can be used for voting
    const canUseWallet = useMemo(() => {
        return canUseWalletForVoting(walletBalance, community);
    }, [walletBalance, community]);

    // Calculate vote breakdown: quota vs wallet
    const voteBreakdown = useMemo(() => {
        const voteAmount = absAmount;
        if (!isPositive) {
            // Downvotes use wallet only
            return {
                quotaAmount: 0,
                walletAmount: voteAmount,
            };
        }

        // Upvotes: use quota first, then wallet
        const quotaAmount = Math.min(voteAmount, quotaRemaining);
        const walletAmount = Math.max(0, voteAmount - quotaRemaining);
        return {
            quotaAmount,
            walletAmount,
        };
    }, [absAmount, isPositive, quotaRemaining]);

    // Button handlers
    const handleDecrease = () => {
        const newAmount = amount - 1;
        const maxNegative = maxMinus > 0 ? -maxMinus : 0;
        setAmount(Math.max(maxNegative, newAmount));
    };

    const handleIncrease = () => {
        const newAmount = amount + 1;
        setAmount(Math.min(maxPlus, newAmount));
    };

    // Calculate if button should be disabled
    const isButtonDisabled = absAmount === 0 || (!hideComment && isPositive && !comment.trim());

    // Calculate which error message to show
    const getButtonError = (): string | null => {
        if (!isButtonDisabled) return null;
        if (absAmount === 0) {
            if (hideQuota) {
                return tShared("pleaseChooseWithdrawAmount");
            }
            return hideComment ? (tShared("pleaseAdjustSlider") || t("requiresVoteAmount")) : t("requiresVoteAmount");
        }
        if (!hideComment && isPositive && !comment.trim()) return t("requiresComment");
        return null;
    };

    const buttonError = getButtonError();

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

    return (
        <div
            className={classList(
                "w-[336px] bg-base-100 flex flex-col gap-5 shadow-xl overflow-y-auto",
                inline
                    ? "rounded-[8px] mx-auto"
                    : "fixed bottom-0 left-1/2 transform -translate-x-1/2 rounded-t-[8px] z-50 max-h-[90vh]"
            )}
            style={{ padding: "16px 16px 20px" }}
        >
            <h2
                className="text-base-content font-bold leading-[41px] tracking-[0.374px]"
                style={{
                    width: "304px",
                    height: "41px",
                    fontSize: "24px",
                    fontFamily:
                        "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
                    fontWeight: 700,
                }}
            >
                {title || t("voteTitle")}
            </h2>

            {/* Description */}
            {!hideComment && (
                <p
                    className="text-base-content leading-[120%] flex items-center"
                    style={{
                        width: "304px",
                        height: "36px",
                        fontSize: "15px",
                        fontFamily: "Roboto, sans-serif",
                        fontWeight: 400,
                    }}
                >
                    {t("sliderHint")}
                </p>
            )}

            {/* Error message - validation errors shown here to prevent button movement */}
            {buttonError && (
                <div
                    className="text-error text-center"
                    style={{
                        fontSize: "12px",
                        fontFamily: "Roboto, sans-serif",
                        fontWeight: 400,
                        lineHeight: "120%",
                        letterSpacing: "0.374px",
                    }}
                >
                    {buttonError}
                </div>
            )}

            {/* Voting Section */}
            {!hideQuota && (
                <div
                    className="flex flex-col gap-5"
                    style={{ width: "304px", height: "167px" }}
                >
                    {/* Limit Group - Dual Progress Bars */}
                    <div
                        className="flex flex-row items-center gap-[11px]"
                        style={{ width: "304px", height: "59px" }}
                    >
                        {/* Quota Bar */}
                        <div
                            className="flex flex-col gap-[5px] isolation-isolate"
                            style={{
                                width: `${barSizing.quotaBarWidth}px`,
                                height: "59px",
                                flexShrink: 0,
                            }}
                        >
                            <div
                                className="text-base-content opacity-60"
                                style={{
                                    width: "100%",
                                    height: "14px",
                                    fontSize: "12px",
                                    fontFamily: "Roboto, sans-serif",
                                    fontWeight: 400,
                                    lineHeight: "120%",
                                    letterSpacing: "0.374px",
                                }}
                            >
                                {t("dailyLimit")}
                            </div>
                            <div
                                className="relative flex items-center justify-center overflow-hidden bg-base-200"
                                style={{
                                    width: "100%",
                                    height: "40px",
                                }}
                            >
                                {(() => {
                                    const totalQuota = dailyQuota || quotaRemaining + usedToday;
                                    if (totalQuota <= 0) return null;

                                    const usedPercent = (usedToday / totalQuota) * 100;
                                    const voteQuotaPercent = voteBreakdown.quotaAmount > 0
                                        ? (voteBreakdown.quotaAmount / totalQuota) * 100
                                        : 0;
                                    const usedWidth = Math.min(100, usedPercent);
                                    const maxVoteWidth = isPositive
                                        ? Math.min(100 - usedWidth, (quotaRemaining / totalQuota) * 100)
                                        : Math.min(100 - usedWidth, voteQuotaPercent);
                                    const voteWidth = voteBreakdown.quotaAmount > 0
                                        ? Math.min(maxVoteWidth, voteQuotaPercent)
                                        : 0;

                                    return (
                                        <>
                                            {/* Already used quota - striped pattern */}
                                            {usedToday > 0 && (
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 opacity-40"
                                                    style={{
                                                        width: `${usedWidth}%`,
                                                        backgroundImage:
                                                            "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 8px)",
                                                        backgroundColor: "var(--base-content)",
                                                        zIndex: 1,
                                                    }}
                                                />
                                            )}

                                            {/* Current vote amount - colored by direction */}
                                            {voteBreakdown.quotaAmount > 0 && (
                                                <div
                                                    className={classList(
                                                        "absolute top-0 bottom-0",
                                                        isPositive ? "bg-success" : "bg-error"
                                                    )}
                                                    style={{
                                                        // For upvotes, fill from left (after used quota); for downvotes, fill from right
                                                        ...(isPositive
                                                            ? { left: `${usedWidth}%`, width: `${voteWidth}%` }
                                                            : { right: 0, width: `${voteWidth}%` }
                                                        ),
                                                        zIndex: 2,
                                                    }}
                                                />
                                            )}
                                        </>
                                    );
                                })()}

                                <span
                                    className="relative z-10 text-base-content"
                                    style={{
                                        fontSize: "12px",
                                        fontFamily: "Roboto, sans-serif",
                                        fontWeight: 400,
                                        lineHeight: "120%",
                                        letterSpacing: "0.374px",
                                    }}
                                >
                                    {quotaRemaining}
                                </span>
                            </div>
                        </div>

                        {/* Wallet Bar - Only show if can use wallet */}
                        {canUseWallet && (
                            <div
                                className="flex flex-col gap-[5px] isolation-isolate flex-grow"
                                style={{
                                    width: `${barSizing.walletBarWidth}px`,
                                    height: "59px",
                                    flexShrink: 0,
                                }}
                            >
                                <div
                                    className="text-base-content opacity-60"
                                    style={{
                                        width: "100%",
                                        height: "14px",
                                        fontSize: "12px",
                                        fontFamily: "Roboto, sans-serif",
                                        fontWeight: 400,
                                        lineHeight: "120%",
                                        letterSpacing: "0.374px",
                                    }}
                                >
                                    Основной счет
                                </div>
                                <div
                                    className="relative flex items-center justify-center overflow-hidden bg-base-200"
                                    style={{
                                        width: "100%",
                                        height: "40px",
                                    }}
                                >
                                    {(() => {
                                        // For downvotes, always use wallet (wallet only)
                                        // For upvotes, wallet only activates when quota is fully used
                                        const shouldShowWallet = !isPositive
                                            ? voteBreakdown.walletAmount > 0  // Downvotes always use wallet
                                            : (quotaRemaining === 0 || voteBreakdown.quotaAmount >= quotaRemaining); // Upvotes use wallet when quota exhausted

                                        const walletPercent = shouldShowWallet && voteBreakdown.walletAmount > 0
                                            ? (voteBreakdown.walletAmount / walletBalance) * 100
                                            : 0;

                                        return (
                                            <>
                                                {/* Current vote - colored by direction */}
                                                {shouldShowWallet && voteBreakdown.walletAmount > 0 && (
                                                    <div
                                                        className={classList(
                                                            "absolute top-0 bottom-0",
                                                            isPositive ? "bg-success" : "bg-error"
                                                        )}
                                                        style={{
                                                            // For downvotes, fill from right to left; for upvotes, fill from left to right
                                                            ...(isPositive
                                                                ? { left: 0, width: `${Math.min(100, walletPercent)}%` }
                                                                : { right: 0, width: `${Math.min(100, walletPercent)}%` }
                                                            ),
                                                            zIndex: 2,
                                                        }}
                                                    />
                                                )}
                                            </>
                                        );
                                    })()}

                                    <span
                                        className="relative z-10 text-base-content"
                                        style={{
                                            fontSize: "12px",
                                            fontFamily: "Roboto, sans-serif",
                                            fontWeight: 400,
                                            lineHeight: "120%",
                                            letterSpacing: "0.374px",
                                        }}
                                    >
                                        {walletBalance}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* +/- Buttons Group */}
                    <div
                        className="flex flex-row justify-between items-center"
                        style={{
                            width: "304px",
                            height: "88px",
                            padding: "24px 0px",
                        }}
                    >
                        {/* Decrease Button */}
                        <Button
                            onClick={handleDecrease}
                            disabled={amount <= (maxMinus > 0 ? -maxMinus : 0)}
                            variant="outline"
                            size="icon"
                            className="w-[70px] h-10"
                        >
                            <Icon name="remove" size={24} />
                        </Button>

                        {/* Vote Amount Display */}
                        <div
                            className={classList(
                                "flex items-center justify-center font-medium",
                                isPositive ? "text-success" : "text-error"
                            )}
                            style={{
                                width: "48px",
                                height: "34px",
                                fontSize: "28px",
                                fontFamily: "Roboto, sans-serif",
                                fontWeight: 500,
                                lineHeight: "120%",
                            }}
                        >
                            {amount > 0 ? `+${amount}` : amount}
                        </div>

                        {/* Increase Button */}
                        <Button
                            onClick={handleIncrease}
                            disabled={amount >= maxPlus}
                            variant="outline"
                            size="icon"
                            className="w-[70px] h-10"
                        >
                            <Icon name="add" size={24} />
                        </Button>
                    </div>
                </div>
            )}

            {/* Notice when no quota and no wallet */}
            {!hideQuota && quotaRemaining === 0 && !canUseWallet && (
                <div
                    className="text-center text-base-content/60 py-4"
                    style={{ width: "304px", margin: "0 auto" }}
                >
                    {t("noVotesAvailable")}
                </div>
            )}

            {/* Withdraw Progress Bar (when hideQuota is true) */}
            {hideQuota && (
                <div
                    className="flex flex-col gap-5"
                    style={{ width: "304px" }}
                >
                    {/* Progress Bar Section */}
                    <div
                        className="flex flex-col gap-[5px]"
                        style={{
                            width: "304px",
                            height: "59px",
                        }}
                    >
                        <div
                            className="relative flex items-center justify-center overflow-hidden bg-base-200 rounded-[8px]"
                            style={{
                                width: "100%",
                                height: "40px",
                            }}
                        >
                            {(() => {
                                const availableAmount = maxPlus;
                                const withdrawAmount = Math.max(0, Math.min(amount, availableAmount));
                                const percent = availableAmount > 0 ? (withdrawAmount / availableAmount) * 100 : 0;

                                return (
                                    <>
                                        {/* Filled portion - amount to withdraw */}
                                        {withdrawAmount > 0 && (
                                            <div
                                                className="absolute left-0 top-0 bottom-0 bg-primary"
                                                style={{
                                                    width: `${percent}%`,
                                                    zIndex: 2,
                                                }}
                                            />
                                        )}
                                        {/* Numeric indicator */}
                                        <span
                                            className="relative z-10 text-base-content"
                                            style={{
                                                fontSize: "12px",
                                                fontFamily: "Roboto, sans-serif",
                                                fontWeight: 400,
                                                lineHeight: "120%",
                                                letterSpacing: "0.374px",
                                            }}
                                        >
                                            {withdrawAmount} / {availableAmount}
                                        </span>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* +/- Buttons */}
                    <div
                        className="flex flex-row justify-between items-center"
                        style={{
                            width: "304px",
                            height: "88px",
                            padding: "24px 0px",
                        }}
                    >
                        {/* Decrease Button */}
                        <Button
                            onClick={handleDecrease}
                            disabled={amount <= 0}
                            variant="outline"
                            size="icon"
                            className="w-[70px] h-10"
                        >
                            <Icon name="remove" size={24} />
                        </Button>

                        {/* Vote Amount Display */}
                        <div
                            className="flex items-center justify-center font-medium text-base-content"
                            style={{
                                width: "48px",
                                height: "34px",
                                fontSize: "28px",
                                fontFamily: "Roboto, sans-serif",
                                fontWeight: 500,
                                lineHeight: "120%",
                            }}
                        >
                            {amount > 0 ? `+${amount}` : amount}
                        </div>

                        {/* Increase Button */}
                        <Button
                            onClick={handleIncrease}
                            disabled={amount >= maxPlus}
                            variant="outline"
                            size="icon"
                            className="w-[70px] h-10"
                        >
                            <Icon name="add" size={24} />
                        </Button>
                    </div>
                </div>
            )}

            {/* Comment Input */}
            {!hideComment && (
                <div className="flex flex-col w-full max-w-[304px]">
                    <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t("textField")}
                        className="min-h-[80px] resize-none"
                    />
                </div>
            )}

            {/* Image Gallery */}
            {onImagesChange && !hideImages && enableCommentImageUploads && (
                <div className="flex flex-col gap-1" style={{ width: "304px" }}>
                    <ImageGallery
                        images={images}
                        onImagesChange={onImagesChange}
                        disabled={isViewer}
                        className="w-full"
                    />
                </div>
            )}

            {/* Submit Button */}
            <div className="flex flex-col gap-1 w-full max-w-[304px]">
                <Button
                    onClick={() => {
                        if (onSubmitSimple) {
                            onSubmitSimple();
                        } else {
                            onSubmit(isPositive);
                        }
                    }}
                    variant={isPositive ? "default" : "destructive"}
                    className="w-full h-10 sticky bottom-0"
                    disabled={isButtonDisabled}
                >
                    {t("submit")}
                </Button>
                {/* Server error (if any) - validation errors are shown after description */}
                {error && (
                    <div
                        className="text-error text-center"
                        style={{
                            fontSize: "12px",
                            fontFamily: "Roboto, sans-serif",
                            fontWeight: 400,
                            lineHeight: "120%",
                            letterSpacing: "0.374px",
                        }}
                    >
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};
