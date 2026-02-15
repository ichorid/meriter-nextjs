/**
 * Email Authentication Dialog
 * 
 * Flow:
 * 1. Email input
 * 2. Send OTP
 * 3. Verify OTP
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
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { isTestAuthMode } from "@/config";
import { mockEmailAuth } from "@/lib/utils/mock-auth";

interface EmailAuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (result: { isNewUser: boolean; user: any }) => void;
    onError: (message: string) => void;
}

type Step = "email" | "otp";

export function EmailAuthDialog({
    open,
    onOpenChange,
    onSuccess,
    onError,
}: EmailAuthDialogProps) {
    // Using a new namespace - keys need to be added to en.json/ru.json
    const t = useTranslations("login.emailDialog");
    const tCommon = useTranslations("common");
    const tLogin = useTranslations("login");

    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [canResendAt, setCanResendAt] = useState<Date | null>(null);
    const [resendCountdown, setResendCountdown] = useState(0);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setStep("email");
            setEmail("");
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

    const validateEmail = (email: string): string | null => {
        if (!email) return "Email is required";
        // Simple regex
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return "Invalid email format";
        }
        return null;
    };

    const handleSendOtp = async () => {
        const validationError = validateEmail(email);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const response = await fetch("/api/v1/auth/email/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data?.error?.message ?? data?.message ?? "Failed to send code");
            }

            if (data.canResendAt) {
                setCanResendAt(new Date(data.canResendAt * 1000)); // API usually returns seconds timestamp? Service returns seconds timestamp. Yes.
                // Wait, service returns `canResendAt` as `Math.floor(now.getTime() / 1000) + this.resendCooldownSeconds`.
                // So it is unix timestamp in seconds.
                // My code here: `new Date(data.canResendAt * 1000)` handles it correctly.
            }

            setStep("otp");
        } catch (err: any) {
            const message = err.message || "Failed to send email";
            setError(message);
            onError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otpCode || otpCode.length !== 6) {
            setError("Invalid code length");
            return;
        }

        setIsLoading(true);
        setError("");

        const testAuthMode = isTestAuthMode();

        try {
            if (testAuthMode) {
                // In test auth mode, use mock authentication
                const result = await mockEmailAuth(email);
                
                // Set JWT cookie manually
                document.cookie = `jwt=${result.jwt}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
                
                onSuccess({
                    isNewUser: result.isNewUser,
                    user: result.user,
                });
                onOpenChange(false);
                setIsLoading(false);
                return;
            }

            const response = await fetch("/api/v1/auth/email/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otpCode }),
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data?.error?.message ?? data?.message ?? "Failed to verify code");
            }

            onSuccess({
                isNewUser: data.isNewUser,
                user: data.user,
            });
            onOpenChange(false);
        } catch (err: any) {
            const message = err.message || "Verification failed";
            setError(message);
            onError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        setOtpCode("");
        await handleSendOtp();
    };

    const handleBack = () => {
        setStep("email");
        setOtpCode("");
        setError("");
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
                                className="absolute left-0 top-0 p-0 h-auto hover:bg-transparent"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        )}
                        Sign in with Email
                    </DialogTitle>
                    <DialogDescription>
                        {step === "email" ? "Enter your email address to receive a login code" : "Enter the code sent to your email"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {step === "email" ? (
                        <>
                            <BrandFormControl
                                label="Email"
                                error={error}
                            >
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setError("");
                                    }}
                                    placeholder="your@email.com"
                                    disabled={isLoading}
                                    className="h-11 rounded-xl focus-visible:outline-none focus-visible:ring-0"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !isLoading) handleSendOtp();
                                    }}
                                />
                            </BrandFormControl>
                            <Button
                                onClick={handleSendOtp}
                                disabled={isLoading || !email}
                                className="w-full"
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                Send Code
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="text-sm text-muted-foreground">
                                Sent to <strong>{email}</strong>
                            </div>

                            <BrandFormControl
                                label="Verification Code"
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
                                    placeholder="000000"
                                    disabled={isLoading}
                                    className="h-11 rounded-xl text-center text-2xl tracking-widest focus-visible:outline-none focus-visible:ring-0"
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
                                        Verifying...
                                    </>
                                ) : (
                                    "Verify"
                                )}
                            </Button>

                            <Button
                                variant="outline"
                                onClick={handleResend}
                                disabled={isLoading || resendCountdown > 0}
                                className="w-full"
                            >
                                {resendCountdown > 0
                                    ? `Resend in ${resendCountdown}s`
                                    : "Resend Code"}
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
