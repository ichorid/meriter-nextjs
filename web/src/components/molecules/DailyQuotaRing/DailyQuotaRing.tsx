"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

export interface DailyQuotaRingProps {
    remaining: number;
    max: number;
    onClick?: (e?: React.MouseEvent) => void;
    className?: string;
    style?: React.CSSProperties;
    asDiv?: boolean; // If true, render as div instead of button (for use inside other buttons)
    flashTrigger?: number; // Incrementing number that triggers flash animation when changed
    variant?: "default" | "golden";
    inverted?: boolean; // If true, use inverted colors (for use on dark/colored backgrounds)
}

export const DailyQuotaRing: React.FC<DailyQuotaRingProps> = ({
    remaining,
    max,
    onClick,
    className = "",
    style,
    asDiv = false,
    flashTrigger,
    variant = "default",
    inverted = false,
}) => {
    const prevRemainingRef = useRef(remaining);
    const numberRef = useRef<HTMLSpanElement>(null);
    const ringRef = useRef<HTMLButtonElement | HTMLDivElement | null>(null);
    const prevFlashTriggerRef = useRef<number | undefined>(flashTrigger);

    // Animated ratio for smooth transitions
    const [animatedRatio, setAnimatedRatio] = useState(() => {
        return max > 0 ? Math.max(0, Math.min(remaining / max, 1)) : 0;
    });

    // Smoothly animate ratio changes
    useEffect(() => {
        const targetRatio =
            max > 0 ? Math.max(0, Math.min(remaining / max, 1)) : 0;
        if (Math.abs(animatedRatio - targetRatio) > 0.001) {
            const startRatio = animatedRatio;
            const startTime = Date.now();
            const duration = 500; // 500ms animation

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease-out cubic function for smooth deceleration
                const eased = 1 - Math.pow(1 - progress, 3);
                const currentRatio =
                    startRatio + (targetRatio - startRatio) * eased;
                setAnimatedRatio(currentRatio);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    setAnimatedRatio(targetRatio);
                }
            };

            requestAnimationFrame(animate);
        }
    }, [remaining, max, animatedRatio]);

    // Trigger number scale animation when remaining changes
    useEffect(() => {
        if (prevRemainingRef.current !== remaining && numberRef.current) {
            numberRef.current.classList.add("quota-number-change");
            const timer = setTimeout(() => {
                numberRef.current?.classList.remove("quota-number-change");
            }, 300);
            return () => clearTimeout(timer);
        }
        prevRemainingRef.current = remaining;
        return undefined;
    }, [remaining]);

    // Trigger flash animation when flashTrigger changes
    useEffect(() => {
        if (
            flashTrigger !== undefined &&
            flashTrigger !== prevFlashTriggerRef.current &&
            ringRef.current
        ) {
            ringRef.current.classList.add("daily-quota-ring--flash");
            const timer = setTimeout(() => {
                ringRef.current?.classList.remove("daily-quota-ring--flash");
            }, 400);
            prevFlashTriggerRef.current = flashTrigger;
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [flashTrigger]);

    // Calculate color based on current ratio
    const currentRatio = animatedRatio;
    const color =
        remaining === 0
            ? "#D4D4D8" // grey
            : currentRatio > 0.7
            ? "#22C55E" // green
            : currentRatio > 0.3
            ? "#EAB308" // yellow
            : "#F97316"; // orange/red

    // SVG circle parameters
    const size = 30;
    const strokeWidth = 2.5;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - currentRatio);

    const showPulse = remaining > 0;
    const isComplete = remaining === 0 && max > 0;

    const handleClick = (e: React.MouseEvent) => {
        if (onClick && !asDiv) {
            e.stopPropagation();
            e.preventDefault();
            // Stop immediate propagation to prevent other handlers
            if (
                e.nativeEvent &&
                typeof (e.nativeEvent as any).stopImmediatePropagation ===
                    "function"
            ) {
                (e.nativeEvent as any).stopImmediatePropagation();
            }
            onClick(e);
        }
    };

    // Also handle capture phase to stop propagation early
    const handleClickCapture = (e: React.MouseEvent) => {
        if (onClick && !asDiv) {
            e.stopPropagation();
        }
    };

    const commonProps = {
        onClick: asDiv ? undefined : handleClick,
        onClickCapture: asDiv ? undefined : handleClickCapture,
        className: `
      daily-quota-ring
      ${showPulse ? "daily-quota-ring--pulse" : ""}
      ${inverted ? "daily-quota-ring--inverted" : ""}
      ${className}
    `,
        style: { ...style },
        "aria-label": `Daily quota: ${remaining} of ${max} remaining`,
    };

    const innerContent = (
        <div className="daily-quota-ring__inner">
            {/* SVG Ring */}
            <svg
                className="daily-quota-ring__svg"
                width={size}
                height={size}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    transform: "rotate(-90deg)", // Start from top
                }}
            >
                {/* Background circle (track) */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#E4E4E7"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                {remaining > 0 && (
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{
                            transition:
                                "stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease-out",
                        }}
                    />
                )}
            </svg>
            {/* Content (number or checkmark) */}
            {isComplete ? (
                <Check className="daily-quota-ring__checkmark" size={14} />
            ) : (
                <span
                    ref={numberRef}
                    className={`daily-quota-ring__number ${
                        variant === "golden"
                            ? "!text-[#D97706] dark:!text-[#FBBF24]"
                            : inverted
                            ? "daily-quota-ring__number--inverted"
                            : ""
                    }`}
                >
                    {remaining}
                </span>
            )}
        </div>
    );

    if (asDiv) {
        return (
            <div {...commonProps} ref={ringRef as React.Ref<HTMLDivElement>}>
                {innerContent}
            </div>
        );
    }

    return (
        <button
            {...commonProps}
            type="button"
            ref={ringRef as React.Ref<HTMLButtonElement>}
        >
            {innerContent}
        </button>
    );
};
