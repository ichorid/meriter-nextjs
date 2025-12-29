/**
 * SMS Authentication Dialog
 * 
 * Two-step flow:
 * 1. Phone number input with E.164 validation (must start with +)
 * 2. OTP verification with resend capability
 */

"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/shadcn/dialog";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
import { BrandFormControl } from "@/components/ui";
import { Loader2, Smartphone, ArrowLeft } from "lucide-react";
import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";

interface SmsAuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (result: { isNewUser: boolean; user: any }) => void;
    onError: (message: string) => void;
}

type Step = "phone" | "otp";

export function SmsAuthDialog({
    open,
    onOpenChange,
    onSuccess,
    onError,
}: SmsAuthDialogProps) {
    const t = useTranslations("login.smsDialog");

    const [step, setStep] = useState<Step>("phone");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [canResendAt, setCanResendAt] = useState<Date | null>(null);
    const [resendCountdown, setResendCountdown] = useState(0);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setStep("phone");
            setPhoneNumber("");
            setOtpCode("");
            setError("");
            setCanResendAt(null);
            setResendCountdown(0);
        }
    }, [open]);

    // Countdown timer for resend button
    useEffect(() => {
        if (!canResendAt) return;

        const interval = setInterval(() => {
            const now = new Date();
            const diff = Math.max(0, Math.floor((canResendAt.getTime() - now.getTime()) / 1000));
            setResendCountdown(diff);

            if (diff === 0) {
                setCanResendAt(null);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [canResendAt]);

    // Validate phone number (E.164 format)
    const validatePhone = (phone: string): string | null => {
        if (!phone) {
            return t("invalidPhone");
        }

        if (!phone.startsWith("+")) {
            return t("mustStartWithPlus");
        }

        try {
            if (!isValidPhoneNumber(phone)) {
                return t("invalidPhone");
            }
            return null;
        } catch {
            return t("invalidPhone");
        }
    };

    // Send OTP
    const handleSendOtp = async () => {
        const validationError = validatePhone(phoneNumber);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const response = await fetch("/api/v1/auth/sms/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to send SMS");
            }

            // Set resend cooldown
            if (data.canResendAt) {
                setCanResendAt(new Date(data.canResendAt));
            }

            setStep("otp");
        } catch (err: any) {
            const message = err.message || t("sendFailed");
            setError(message);
            onError(message);
        } finally {
            setIsLoading(false);
        }
    };

    // Verify OTP
    const handleVerifyOtp = async () => {
        if (!otpCode || otpCode.length !== 6) {
            setError(t("invalidOtp"));
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const response = await fetch("/api/v1/auth/sms/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumber, otpCode }),
                credentials: "include", // Important for cookies
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to verify OTP");
            }

            onSuccess({
                isNewUser: data.isNewUser,
                user: data.user,
            });
            onOpenChange(false);
        } catch (err: any) {
            const message = err.message || t("verifyFailed");
            setError(message);
            onError(message);
        } finally {
            setIsLoading(false);
        }
    };

    // Resend OTP
    const handleResend = async () => {
        setOtpCode("");
        await handleSendOtp();
    };

    // Back to phone input
    const handleBack = () => {
        setStep("phone");
        setOtpCode("");
        setError("");
    };

    // Format phone number for display
    const formatPhoneForDisplay = (phone: string): string => {
        try {
            const parsed = parsePhoneNumber(phone);
            return parsed?.formatInternational() || phone;
        } catch {
            return phone;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="relative">
                        {step === "otp" && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleBack}
                                disabled={isLoading}
                                className="p-0 h-auto hover:bg-transparent absolute left-0"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        )}
                        {t("title")}
                    </DialogTitle>
                    <DialogDescription>
                        {step === "phone"
                            ? t("description")
                            : t("otpDescription")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {step === "phone" ? (
                        <>
                            <BrandFormControl
                                label={t("phoneLabel")}
                                error={error}
                            >
                                <Input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => {
                                        let value = e.target.value;

                                        // Auto-add + prefix if user starts typing without it
                                        if (value.length > 0 && !value.startsWith('+')) {
                                            value = '+' + value;
                                        }

                                        // Only allow digits and + at the start
                                        const cleaned = value.replace(/[^+\d]/g, '');

                                        // Ensure + is only at the start
                                        if (cleaned.length > 0) {
                                            const digits = cleaned.replace(/\+/g, '');
                                            setPhoneNumber('+' + digits);
                                        } else {
                                            setPhoneNumber('+');
                                        }
                                        setError("");
                                    }}
                                    placeholder={t("phonePlaceholder")}
                                    disabled={isLoading}
                                    className="h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !isLoading) {
                                            handleSendOtp();
                                        }
                                    }}
                                />
                            </BrandFormControl>

                            <div className="text-xs text-muted-foreground">
                                {t("phoneHint")}
                            </div>

                            <Button
                                onClick={handleSendOtp}
                                disabled={isLoading || !phoneNumber.startsWith("+")}
                                className="w-full"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t("sending")}
                                    </>
                                ) : (
                                    t("sendCode")
                                )}
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="text-sm text-muted-foreground">
                                {t("sentTo")} <strong>{formatPhoneForDisplay(phoneNumber)}</strong>
                            </div>

                            <BrandFormControl
                                label={t("otpLabel")}
                                error={error}
                            >
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    value={otpCode}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, "");
                                        setOtpCode(value);
                                        setError("");
                                    }}
                                    placeholder={t("otpPlaceholder")}
                                    disabled={isLoading}
                                    className="h-11 rounded-xl text-center text-2xl tracking-widest"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !isLoading && otpCode.length === 6) {
                                            handleVerifyOtp();
                                        }
                                    }}
                                />
                            </BrandFormControl>

                            <Button
                                onClick={handleVerifyOtp}
                                disabled={isLoading || otpCode.length !== 6}
                                className="w-full"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t("verifying")}
                                    </>
                                ) : (
                                    t("verify")
                                )}
                            </Button>

                            <Button
                                variant="outline"
                                onClick={handleResend}
                                disabled={isLoading || resendCountdown > 0}
                                className="w-full"
                            >
                                {resendCountdown > 0
                                    ? t("resendIn", { seconds: resendCountdown })
                                    : t("resendCode")}
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
