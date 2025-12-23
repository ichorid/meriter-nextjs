"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
    Slider,
    SliderTrack,
    SliderFilledTrack,
    SliderThumb,
} from "@/components/ui/slider";
import { useTranslations } from "next-intl";
import { classList } from "@/shared/lib/classList";
import { ImageGallery } from "@/components/ui/ImageGallery";
import { useFeaturesConfig } from "@/hooks/useConfig";

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
    // In withdraw mode, force positive direction
    const [voteDirection, setVoteDirection] = useState<"positive" | "negative">(
        hideDirectionToggle ? "positive" : "positive"
    );
    const prevDirectionRef = React.useRef<"positive" | "negative">("positive");

    // Check if downvote is available (disabled in withdraw mode)
    const canDownvote = !hideDirectionToggle && maxMinus > 0 && !isViewer;

    // Calculate slider range - now only goes from 0 to max (right only)
    const max = voteDirection === "positive" ? maxPlus : maxMinus;
    const min = 0;

    // Get absolute slider value (0 to max)
    const sliderValue = Math.abs(amount);

    const handleSliderChange = useCallback(
        (value: number) => {
            // Convert to signed value based on direction
            const signedValue = voteDirection === "positive" ? value : -value;
            setAmount(signedValue);
        },
        [voteDirection, setAmount]
    );

    // When direction changes, always reset slider to zero
    useEffect(() => {
        if (prevDirectionRef.current !== voteDirection) {
            setAmount(0);
            prevDirectionRef.current = voteDirection;
        }
    }, [voteDirection, setAmount]);

    // If downvote becomes unavailable and user is on negative, switch to positive
    useEffect(() => {
        if (!canDownvote && voteDirection === "negative") {
            setVoteDirection("positive");
            setAmount(0);
        }
    }, [canDownvote, voteDirection, setAmount]);

    // Force positive direction in withdraw mode
    useEffect(() => {
        if (hideDirectionToggle && voteDirection === "negative") {
            setVoteDirection("positive");
            setAmount(Math.abs(amount));
        }
    }, [hideDirectionToggle, voteDirection, amount, setAmount]);

    const isPositive = voteDirection === "positive";
    const absAmount = Math.abs(amount);
    
    // Calculate if button should be disabled
    // In withdraw mode (hideComment), don't require comment
    const isButtonDisabled = absAmount === 0 || (!hideComment && isPositive && !comment.trim());
    
    // Calculate which error message to show
    const getButtonError = (): string | null => {
        if (!isButtonDisabled) return null;
        if (absAmount === 0) return hideComment ? (tShared("pleaseAdjustSlider") || t("requiresVoteAmount")) : t("requiresVoteAmount");
        if (!hideComment && isPositive && !comment.trim()) return t("requiresComment");
        return null;
    };
    
    const buttonError = getButtonError();

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

            {/* Vote Direction Toggle */}
            {canDownvote && !hideDirectionToggle && (
                <div
                    className="flex items-center justify-center gap-3"
                    style={{ width: "304px" }}
                >
                    {/* Vote Up Label */}
                    <span
                        className={classList(
                            "font-medium",
                            voteDirection === "positive"
                                ? "text-success font-bold"
                                : "text-base-content opacity-60"
                        )}
                        style={{
                            fontSize: "15px",
                            fontFamily: "Roboto, sans-serif",
                        }}
                    >
                        {t("voteUp")} 👍
                    </span>

                    {/* Toggle Switch */}
                    <label
                        className="flex items-center cursor-pointer"
                        onClick={() => {
                            setVoteDirection(
                                voteDirection === "positive"
                                    ? "negative"
                                    : "positive"
                            );
                        }}
                    >
                        <div
                            className={classList(
                                "relative inline-flex items-center rounded-full transition-colors duration-200",
                                voteDirection === "positive"
                                    ? "bg-success"
                                    : "bg-error"
                            )}
                            style={{
                                width: "56px",
                                height: "32px",
                            }}
                        >
                            <div
                                className={classList(
                                    "bg-white rounded-full shadow-md transform transition-transform duration-200",
                                    voteDirection === "negative"
                                        ? "translate-x-6"
                                        : "translate-x-1"
                                )}
                                style={{
                                    width: "24px",
                                    height: "24px",
                                }}
                            />
                        </div>
                    </label>

                    {/* Vote Down Label */}
                    <span
                        className={classList(
                            "font-medium",
                            voteDirection === "negative"
                                ? "text-error font-bold"
                                : "text-base-content opacity-60"
                        )}
                        style={{
                            fontSize: "15px",
                            fontFamily: "Roboto, sans-serif",
                        }}
                    >
                        {t("voteDown")} 👎
                    </span>
                </div>
            )}

            {/* Vote Amount Display - Fixed Position */}
            <div
                className={classList(
                    "flex items-center justify-center font-bold",
                    isPositive ? "text-success" : "text-error"
                )}
                style={{
                    width: "304px",
                    fontSize: "24px",
                    fontFamily: "Roboto, sans-serif",
                    fontWeight: 700,
                    lineHeight: "120%",
                }}
            >
                {hideDirectionToggle ? (
                    <>
                        {absAmount > 0 ? `+${absAmount}` : absAmount}
                    </>
                ) : isPositive ? (
                    <>
                        👍 {t("voteUp")}: +{absAmount}
                    </>
                ) : (
                    <>
                        👎 {t("voteDown")}: -{absAmount}
                    </>
                )}
            </div>

            {/* Limit / Quota Indicator */}
            {!hideQuota && (
            <div
                className="flex flex-col gap-[5px]"
                style={{ width: "304px", height: "40px" }}
            >
                <div
                    className="text-base-content opacity-60"
                    style={{
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
                        width: "304px",
                        height: "40px",
                    }}
                >
                    {/* Calculate percentages */}
                    {(() => {
                        const totalQuota =
                            dailyQuota || quotaRemaining + usedToday;
                        if (totalQuota <= 0) return null;

                        const usedPercent = (usedToday / totalQuota) * 100;
                        // For upvotes, vote amount is part of quota; for downvotes, show it visually but it doesn't use quota
                        const votePercent =
                            absAmount > 0 ? (absAmount / totalQuota) * 100 : 0;
                        const usedWidth = Math.min(100, usedPercent);
                        // For upvotes, vote width is limited by remaining quota; for downvotes, show it after used quota
                        const maxVoteWidth = isPositive
                            ? Math.min(
                                  100 - usedWidth,
                                  (quotaRemaining / totalQuota) * 100
                              )
                            : Math.min(100 - usedWidth, votePercent);
                        const voteWidth =
                            absAmount > 0
                                ? Math.min(maxVoteWidth, votePercent)
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
                                            backgroundColor:
                                                "var(--base-content)",
                                            zIndex: 1,
                                        }}
                                    />
                                )}

                                {/* Current vote amount - colored by direction */}
                                {absAmount > 0 && isPositive && (
                                    <div
                                        className="absolute top-0 bottom-0 bg-success"
                                        style={{
                                            left: `${usedWidth}%`,
                                            width: `${voteWidth}%`,
                                            zIndex: 2,
                                        }}
                                    />
                                )}
                                {absAmount > 0 && !isPositive && (
                                    <div
                                        className="absolute top-0 bottom-0 bg-error"
                                        style={{
                                            left: `${usedWidth}%`,
                                            width: `${voteWidth}%`,
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
                        {t("available")} {quotaRemaining}
                    </span>
                </div>
            </div>
            )}

            {/* Slider Container */}
            {max > 0 ? (
                <div
                    className="flex flex-col gap-1"
                    style={{ width: "304px", margin: "0 auto" }}
                >
                    <div
                        className="relative flex items-center px-2"
                        style={{ width: "100%", height: "40px" }}
                    >
                        <Slider
                            value={sliderValue}
                            minValue={min}
                            maxValue={max}
                            onChange={handleSliderChange}
                            style={{ width: "100%" }}
                        >
                            <SliderTrack
                                style={{
                                    height: 8,
                                    borderRadius: 8,
                                    backgroundColor: "var(--base-200)",
                                }}
                            >
                                <SliderFilledTrack
                                    style={{
                                        height: 8,
                                        borderRadius: 8,
                                        backgroundColor: isPositive
                                            ? "var(--fallback-su,oklch(var(--su)/1))"
                                            : "var(--fallback-er,oklch(var(--er)/1))",
                                    }}
                                />
                            </SliderTrack>
                            <SliderThumb
                                style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 12,
                                    backgroundColor: "var(--base-content)",
                                    borderWidth: 3,
                                    borderColor: "var(--base-100)",
                                    boxShadow:
                                        "0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 3px var(--fallback-bc,oklch(var(--bc)/0.15))",
                                }}
                            />
                        </Slider>
                    </div>
                    {/* Max value indicator */}
                    <div
                        className="text-base-content opacity-60 text-right"
                        style={{
                            fontSize: "12px",
                            fontFamily: "Roboto, sans-serif",
                            fontWeight: 400,
                            lineHeight: "120%",
                            letterSpacing: "0.374px",
                        }}
                    >
                        {t("maxVoteAmount", { max })}
                    </div>
                </div>
            ) : (
                <div
                    className="text-center text-base-content/60 py-4"
                    style={{ width: "304px", margin: "0 auto" }}
                >
                    {t("noVotesAvailable")}
                </div>
            )}

            {/* Comment Input */}
            {!hideComment && (
            <div className="flex flex-col gap-1" style={{ width: "304px" }}>
                <label
                    className="text-base-content opacity-60"
                    style={{
                        fontSize: "12px",
                        fontFamily: "Roboto, sans-serif",
                        fontWeight: 400,
                        lineHeight: "120%",
                        letterSpacing: "0.374px",
                    }}
                >
                    {t("explanationDetails")}
                </label>
                <div
                    className="bg-base-100 border border-base-content rounded-[8px]"
                    style={{
                        width: "304px",
                        height: "80px",
                        padding: "8px 12px",
                        boxSizing: "border-box",
                    }}
                >
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full h-full resize-none outline-none text-base-content placeholder:text-base-content placeholder:opacity-50"
                        style={{
                            fontSize: "15px",
                            fontFamily: "Roboto, sans-serif",
                            fontWeight: 400,
                            lineHeight: "120%",
                        }}
                        placeholder={t("textField")}
                    />
                </div>
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
            <div className="flex flex-col gap-1" style={{ width: "304px" }}>
                <button
                    onClick={() => {
                        if (onSubmitSimple) {
                            onSubmitSimple();
                        } else {
                            onSubmit(isPositive);
                        }
                    }}
                    className={classList(
                        "flex justify-center items-center border rounded-[8px] sticky bottom-0",
                        isPositive
                            ? "border-success bg-success hover:bg-success/90"
                            : "border-error bg-error hover:bg-error/90",
                        isButtonDisabled ? "opacity-50 cursor-not-allowed" : ""
                    )}
                    style={{
                        width: "100%",
                        height: "40px",
                        padding: "11px 15px",
                        gap: "10px",
                        boxSizing: "border-box",
                    }}
                    disabled={isButtonDisabled}
                >
                    <span
                        className="text-base-100 text-center leading-[120%]"
                        style={{
                            fontSize: "15px",
                            fontFamily: "Roboto, sans-serif",
                            fontWeight: 400,
                        }}
                    >
                        {t("submit")}
                    </span>
                </button>
                {/* Error text when button is disabled or server error */}
                {(buttonError || error) && (
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
                        {error || buttonError}
                    </div>
                )}
            </div>
        </div>
    );
};
