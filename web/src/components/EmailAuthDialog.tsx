/**
 * Email Authentication Dialog
 *
 * Flow:
 * 1. Email input
 * 2. Send one-time login link to the email
 * 3. User clicks the link in the email — the tab where it opens is logged in.
 *    This dialog polls the session so the original tab logs in too when the
 *    link is opened on the same device/browser.
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
import { Loader2, Mail, MailCheck, ArrowLeft } from "lucide-react";
import { isTestAuthMode } from "@/config";
import { mockEmailAuth } from "@/lib/utils/mock-auth";
import { trpc } from "@/lib/trpc/client";

interface EmailAuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (result: { isNewUser: boolean; user: unknown }) => void;
    onError: (message: string) => void;
}

type Step = "email" | "sent";

export function EmailAuthDialog({
    open,
    onOpenChange,
    onSuccess,
    onError,
}: EmailAuthDialogProps) {
    const t = useTranslations("login.emailDialog");
    const tCommon = useTranslations("common");

    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [canResendAt, setCanResendAt] = useState<Date | null>(null);
    const [resendCountdown, setResendCountdown] = useState(0);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setStep("email");
            setEmail("");
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

    // Once the link is sent, poll the session: if the user opens the magic link
    // in another tab on this device, the JWT cookie appears and this tab can log in too.
    const sessionPoll = trpc.users.getMe.useQuery(undefined, {
        enabled: open && step === "sent",
        refetchInterval: 3000,
        retry: false,
        staleTime: 0,
        gcTime: 0,
    });

    useEffect(() => {
        if (open && step === "sent" && sessionPoll.data) {
            onSuccess({ isNewUser: false, user: sessionPoll.data });
            onOpenChange(false);
        }
    }, [open, step, sessionPoll.data, onSuccess, onOpenChange]);

    const validateEmail = (email: string): string | null => {
        if (!email) return t("invalidEmail");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return t("invalidEmail");
        }
        return null;
    };

    const handleSendLink = async () => {
        const validationError = validateEmail(email);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            if (isTestAuthMode()) {
                // In test auth mode there is no real mailbox: log in immediately
                const result = await mockEmailAuth(email);
                document.cookie = `jwt=${result.jwt}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
                onSuccess({
                    isNewUser: result.isNewUser,
                    user: result.user,
                });
                onOpenChange(false);
                return;
            }

            const response = await fetch("/api/v1/auth/email/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data?.error?.message ?? data?.message ?? t("sendFailed"));
            }

            if (data.canResendAt) {
                // canResendAt is a unix timestamp in seconds
                setCanResendAt(new Date(data.canResendAt * 1000));
            }

            setStep("sent");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t("sendFailed");
            setError(message);
            onError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        setStep("email");
        setError("");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 pr-8 text-left">
                        {step === "sent" && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={handleBack}
                                disabled={isLoading}
                                className="h-9 w-9 shrink-0 -ml-1"
                                aria-label={tCommon("ariaLabels.back")}
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        )}
                        <span className="min-w-0 flex-1 leading-tight">{t("title")}</span>
                    </DialogTitle>
                    <DialogDescription>
                        {step === "email" ? t("description") : t("sentDescription")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {step === "email" ? (
                        <>
                            <BrandFormControl
                                label={t("emailLabel")}
                                error={error}
                            >
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setError("");
                                    }}
                                    placeholder={t("emailPlaceholder")}
                                    disabled={isLoading}
                                    className="h-11 rounded-xl focus-visible:outline-none focus-visible:ring-0"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !isLoading) handleSendLink();
                                    }}
                                />
                            </BrandFormControl>
                            <Button
                                onClick={handleSendLink}
                                disabled={isLoading || !email}
                                className="w-full"
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                {t("sendLink")}
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="flex flex-col items-center gap-3 text-center">
                                <MailCheck className="h-10 w-10 text-primary" />
                                <p className="text-sm text-muted-foreground">
                                    {t.rich("sentTo", {
                                        email,
                                        b: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                                    })}
                                </p>
                                <p className="text-sm text-muted-foreground">{t("sentHint")}</p>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {t("waitingForClick")}
                            </div>

                            {error && (
                                <p className="text-sm text-destructive text-center">{error}</p>
                            )}

                            <Button
                                variant="outline"
                                onClick={handleSendLink}
                                disabled={isLoading || resendCountdown > 0}
                                className="w-full"
                            >
                                {resendCountdown > 0
                                    ? t("resendIn", { seconds: resendCountdown })
                                    : t("resendLink")}
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
