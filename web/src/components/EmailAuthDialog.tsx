/**
 * Email Authentication Dialog
 *
 * Collects the email address and requests a one-time sign-in link.
 * After the link is sent the dialog closes and LoginForm shows the
 * full "check your email" screen (CheckEmailCard).
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
import { Loader2, Mail } from "lucide-react";
import { isTestAuthMode } from "@/config";
import { mockEmailAuth } from "@/lib/utils/mock-auth";

export interface EmailLinkSentInfo {
    email: string;
    /** Unix timestamp (seconds) when resend becomes available */
    canResendAt: number | null;
}

interface EmailAuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called when the sign-in link email was sent successfully */
    onLinkSent: (info: EmailLinkSentInfo) => void;
    /** Test-auth-mode immediate login result */
    onSuccess: (result: { isNewUser: boolean; user: unknown }) => void;
    onError: (message: string) => void;
}

export function EmailAuthDialog({
    open,
    onOpenChange,
    onLinkSent,
    onSuccess,
    onError,
}: EmailAuthDialogProps) {
    const t = useTranslations("login.emailDialog");

    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setEmail("");
            setError("");
        }
    }, [open]);

    const validateEmail = (email: string): string | null => {
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

            onLinkSent({
                email,
                // canResendAt is a unix timestamp in seconds
                canResendAt: typeof data.canResendAt === "number" ? data.canResendAt : null,
            });
            onOpenChange(false);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t("sendFailed");
            setError(message);
            onError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="pr-8 text-left">{t("title")}</DialogTitle>
                    <DialogDescription>{t("description")}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
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
                </div>
            </DialogContent>
        </Dialog>
    );
}
