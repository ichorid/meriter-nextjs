/**
 * "Check your email" screen shown on the login page after a sign-in
 * link was emailed. Polls the session via REST (plain fetch, so the
 * shared tRPC getMe query used by AuthContext is not disturbed) and
 * redirects as soon as the magic link is opened on this device.
 */

"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/shadcn/card";
import { Button } from "@/components/ui/shadcn/button";
import { Loader2, MailCheck, ArrowLeft } from "lucide-react";

interface CheckEmailCardProps {
    email: string;
    /** Unix timestamp (seconds) when resend becomes available */
    canResendAt: number | null;
    onBack: () => void;
    onLoggedIn: () => void;
}

export function CheckEmailCard({
    email,
    canResendAt: initialCanResendAt,
    onBack,
    onLoggedIn,
}: CheckEmailCardProps) {
    const t = useTranslations("login.checkEmail");

    const [canResendAt, setCanResendAt] = useState<number | null>(initialCanResendAt);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [isResending, setIsResending] = useState(false);
    const [error, setError] = useState("");

    // Countdown timer for resend button
    useEffect(() => {
        if (!canResendAt) return;

        const tick = () => {
            const diff = Math.max(0, Math.ceil(canResendAt - Date.now() / 1000));
            setResendCountdown(diff);
            if (diff === 0) setCanResendAt(null);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [canResendAt]);

    // Poll the session: when the magic link is opened in another tab on this
    // device, the JWT cookie appears and this tab can proceed.
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch("/api/v1/auth/me", { credentials: "include" });
                if (res.ok) onLoggedIn();
            } catch {
                // network hiccup — keep polling
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [onLoggedIn]);

    const handleResend = async () => {
        setIsResending(true);
        setError("");
        try {
            const response = await fetch("/api/v1/auth/email/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data?.error?.message ?? data?.message ?? t("sendFailed"));
            }
            if (typeof data.canResendAt === "number") {
                setCanResendAt(data.canResendAt);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t("sendFailed"));
        } finally {
            setIsResending(false);
        }
    };

    return (
        <Card>
            <CardHeader className="items-center text-center">
                <MailCheck className="h-12 w-12 text-primary mb-2" />
                <CardTitle>{t("title")}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                    {t.rich("sentTo", {
                        email,
                        b: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                    })}
                </p>
                <p className="text-sm text-muted-foreground text-center">{t("hint")}</p>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("waiting")}
                </div>

                {error && (
                    <p className="text-sm text-destructive text-center">{error}</p>
                )}

                <Button
                    variant="outline"
                    onClick={handleResend}
                    disabled={isResending || resendCountdown > 0}
                    className="w-full"
                >
                    {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {resendCountdown > 0
                        ? t("resendIn", { seconds: resendCountdown })
                        : t("resend")}
                </Button>

                <Button
                    variant="ghost"
                    onClick={onBack}
                    className="w-full"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("backToLogin")}
                </Button>
            </CardContent>
        </Card>
    );
}
