"use client";

import { useState, useMemo, useCallback, memo, useEffect } from "react";
import { etv } from "@shared/lib/input-utils";
import {
    Slider,
    SliderTrack,
    SliderFilledTrack,
    SliderThumb,
} from "@/components/ui/slider";
import { classList } from "@lib/classList";
import { useTranslations } from "next-intl";
import { useToastStore } from "@/shared/stores/toast.store";

export interface FormCommentVoteBaseProps {
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

export const FormCommentVoteBase = memo(
    ({
        comment,
        setComment,
        freePlus,
        freeMinus,
        amount,
        setAmount,
        maxPlus,
        maxMinus,
        commentAdd,
        error,
        reason,
        isWithdrawMode = false,
        quotaAmount = 0,
        walletAmount = 0,
        quotaRemaining = 0,
        currencyIconUrl,
    }: FormCommentVoteBaseProps) => {
        const t = useTranslations("comments");
        const addToast = useToastStore((state) => state.addToast);
        const [selected, setSelected] = useState(false);
        const overflow = amount >= 0 ? amount > freePlus : amount < -freeMinus;
        const directionPlus = amount > 0;
        const directionMinus = amount < 0;

        // Slider configuration
        const sliderMin = isWithdrawMode ? 0 : maxMinus === 0 ? 0 : -maxMinus;
        const sliderMax = isWithdrawMode ? maxPlus : maxPlus;

        // Memoize onChange handler
        const handleSliderChange = useCallback(
            (value: number) => {
                const clampedAmount = isWithdrawMode
                    ? Math.max(0, Math.min(value, maxPlus))
                    : Math.max(-maxMinus, Math.min(value, maxPlus));
                setAmount(clampedAmount);
            },
            [isWithdrawMode, maxPlus, maxMinus, setAmount]
        );

        // Show error toast when error changes
        useEffect(() => {
            if (error) {
                addToast(error, "error");
            }
        }, [error, addToast]);

        return (
            <div
                className={classList(
                    "p-5 rounded-2xl shadow-lg",
                    directionPlus
                        ? "bg-success/10"
                        : directionMinus
                        ? "bg-error/10"
                        : "bg-base-100"
                )}
            >
                <div className="border-t-2 border-base-300 w-full mb-4"></div>

                {/* Quota/Balance info */}
                {directionPlus && (
                    <div className="text-sm mb-2 text-success">
                        {t("upvoteQuota", {
                            used: Math.min(freePlus, Math.abs(amount)),
                            total: freePlus,
                        })}
                    </div>
                )}
                {directionPlus && (
                    <div className="text-sm mb-2 text-success">
                        {t("upvoteBalance", {
                            amount: overflow ? amount - freePlus : 0,
                        })}
                    </div>
                )}
                {amount === 0 && !isWithdrawMode && (
                    <div className="text-sm mb-2 opacity-60">
                        {t("sliderUpvote")}
                    </div>
                )}
                {amount === 0 && maxMinus != 0 && !isWithdrawMode && (
                    <div className="text-sm mb-2 opacity-60">
                        {t("sliderDownvote")}
                    </div>
                )}
                {directionMinus && freeMinus > 0 && !isWithdrawMode && (
                    <div className="text-sm mb-2 text-error">
                        {t("downvoteQuota", {
                            used: Math.min(freeMinus, Math.abs(amount)),
                            total: freeMinus,
                        })}
                    </div>
                )}
                {directionMinus && !isWithdrawMode && (
                    <div className="text-sm mb-2 text-error">
                        {t("downvoteBalance", {
                            amount: overflow ? amount - freeMinus : 0,
                        })}
                    </div>
                )}

                {/* Slider */}
                <div className="mb-4 px-2">
                    <Slider
                        minValue={sliderMin}
                        maxValue={sliderMax}
                        value={amount}
                        onChange={handleSliderChange}
                    >
                        <SliderTrack
                            style={{
                                height: 6,
                                borderRadius: 8,
                                backgroundColor: "oklch(var(--b3) / 0.8)",
                                borderWidth: 1,
                                borderColor: "oklch(var(--bc) / 0.3)",
                            }}
                        >
                            <SliderFilledTrack
                                style={{
                                    height: 6,
                                    borderRadius: 8,
                                    backgroundColor: directionPlus
                                        ? "oklch(var(--su) / 1)"
                                        : directionMinus
                                        ? "oklch(var(--er) / 1)"
                                        : "oklch(var(--b3) / 1)",
                                }}
                            />
                        </SliderTrack>
                        <SliderThumb
                            style={{
                                width: 20,
                                height: 20,
                                borderRadius: 10,
                                backgroundColor: "oklch(var(--bc) / 1)",
                                borderWidth: 2,
                                borderColor: "oklch(var(--b1) / 1)",
                                boxShadow:
                                    "0 2px 4px rgba(0, 0, 0, 0.2), 0 0 0 2px oklch(var(--bc) / 0.1)",
                            }}
                        />
                    </Slider>
                </div>

                {/* Textarea and submit */}
                <div className="relative">
                    <textarea
                        onClick={() => setSelected(true)}
                        className="textarea textarea-bordered w-full bg-base-100 text-base resize-none"
                        style={
                            selected ? { height: "100px" } : { height: "75px" }
                        }
                        placeholder={
                            reason ?? amount == 0
                                ? t("sliderHint")
                                : t("commentHint")
                        }
                        {...etv(comment, setComment)}
                    />
                    {amount != 0 && (
                        <button
                            onClick={() =>
                                commentAdd(directionPlus ? true : false)
                            }
                            disabled={amount < 0 && !comment?.trim()}
                            className={classList(
                                "btn btn-circle btn-primary absolute bottom-2 right-2",
                                amount < 0 && !comment?.trim()
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                            )}
                        >
                            <img
                                src={"/meriter/send.svg"}
                                alt="Send"
                                className="w-5 h-5"
                            />
                        </button>
                    )}
                </div>

                {/* Warning when comment is empty */}
                {amount !== 0 && !comment?.trim() && (
                    <div className="text-sm text-warning p-2 bg-warning/10 rounded-lg mt-2">
                        <div className="flex items-center gap-2">
                            <svg
                                className="w-5 h-5 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                            <div className="flex-1">
                                <div className="font-medium">
                                    {t("reasonRequired")}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }
);

FormCommentVoteBase.displayName = "FormCommentVoteBase";
