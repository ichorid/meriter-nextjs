/**
 * Centralized Login Form Component
 *
 * Handles authentication methods:
 * - Multiple OAuth providers (Google, Yandex, VK, Telegram, Apple, Twitter, Instagram, Sber)
 * - Passkey authentication (WebAuthn)
 * - Fake authentication (development mode)
 * - Error handling and loading states
 */

"use client";

import React, { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/atoms/LoadingState";
import { getErrorMessage } from "@/lib/api/errors";
import { isFakeDataMode } from "@/config";
import {
    OAUTH_PROVIDERS,
    getOAuthUrl,
} from "@/lib/utils/oauth-providers";
import { Logo } from "@/components/ui";
import { Button } from "@/components/ui/shadcn/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/shadcn/card";
import { Separator } from "@/components/ui/shadcn/separator";
import { useToastStore } from "@/shared/stores/toast.store";
import { PasskeySection } from "./PasskeySection";
import { OAuthButton } from "./OAuthButton";

interface LoginFormProps {
    className?: string;
    enabledProviders?: string[];
    authnEnabled?: boolean;
}

export function LoginForm({
    className = "",
    enabledProviders,
    authnEnabled = false,
}: LoginFormProps) {
    const searchParams = useSearchParams();
    const t = useTranslations("login");
    const fakeDataMode = isFakeDataMode();

    const { authenticateFakeUser, authenticateFakeSuperadmin, isLoading, authError, setAuthError } =
        useAuth();
    const addToast = useToastStore((state) => state.addToast);

    // Get return URL from URL
    const returnTo = searchParams?.get("returnTo");

    // Filter providers if enabledProviders is passed
    const displayedProviders = enabledProviders
        ? OAUTH_PROVIDERS.filter((p) => enabledProviders.includes(p.id))
        : OAUTH_PROVIDERS;

    // Show auth error toast when error changes
    useEffect(() => {
        if (authError) {
            addToast(authError, "error");
        }
    }, [authError, addToast]);

    // Helper function to construct redirect URL
    const buildRedirectUrl = (): string => {
        return returnTo || "/meriter/profile";
    };

    // Handle fake authentication
    const handleFakeAuth = async () => {
        try {
            await authenticateFakeUser();
            const redirectUrl = buildRedirectUrl();
            window.location.href = redirectUrl;
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            console.error("❌ Fake authentication failed:", error);
            setAuthError(message);
            addToast(message, "error");
        }
    };

    // Handle fake superadmin authentication
    const handleFakeSuperadminAuth = async () => {
        try {
            await authenticateFakeSuperadmin();
            const redirectUrl = buildRedirectUrl();
            window.location.href = redirectUrl;
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            console.error("❌ Fake superadmin authentication failed:", error);
            setAuthError(message);
            addToast(message, "error");
        }
    };

    // Handle OAuth provider authentication
    const handleOAuthAuth = (providerId: string) => {
        const returnToPath = buildRedirectUrl();
        const oauthUrl = getOAuthUrl(providerId, returnToPath);
        window.location.href = oauthUrl;
    };

    return (
        <div className={`w-full max-w-md mx-auto ${className}`}>
            {/* Logo and Site Title */}
            <div className="text-center mb-8">
                <div className="flex justify-center items-center gap-3 mb-2">
                    <Logo size={40} className="text-primary" />
                    <h1 className="text-xl font-semibold text-foreground">
                        {t("siteTitle")}
                    </h1>
                </div>
            </div>

            {/* Login Card */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("title")}</CardTitle>
                    <CardDescription>{t("subtitle")}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {isLoading && <LoadingState text={t("authenticating")} />}

                    {!isLoading && (
                        <>
                            {fakeDataMode ? (
                                <div className="space-y-4">
                                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                                        <p className="text-sm text-amber-800 dark:text-amber-200">
                                            {t("fakeDataModeEnabled")}
                                        </p>
                                    </div>
                                    <Button
                                        variant="default"
                                        size="default"
                                        className="w-full"
                                        onClick={handleFakeAuth}
                                        disabled={isLoading}
                                    >
                                        {t("fakeLogin")}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="default"
                                        className="w-full"
                                        onClick={handleFakeSuperadminAuth}
                                        disabled={isLoading}
                                    >
                                        {t("superadminLogin")}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* OAuth Providers */}
                                    {displayedProviders.length > 0 && (
                                        <div className="space-y-2">
                                            {displayedProviders.map((provider) => (
                                                <OAuthButton
                                                    key={provider.id}
                                                    provider={provider}
                                                    onClick={() => handleOAuthAuth(provider.id)}
                                                    disabled={isLoading}
                                                    label={t("signInWith", {
                                                        provider: provider.name,
                                                    })}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Separator between OAuth and Passkey */}
                                    {displayedProviders.length > 0 && authnEnabled && (
                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <Separator />
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-card px-2 text-muted-foreground">
                                                    {t("orContinueWith") || "Or continue with"}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Passkey Authentication */}
                                    {authnEnabled && (
                                        <PasskeySection
                                            isLoading={isLoading}
                                            onSuccess={(result) => {
                                                let redirectUrl = buildRedirectUrl();

                                                // Force welcome page for new users
                                                if (result?.isNewUser) {
                                                    redirectUrl = "/meriter/welcome";
                                                }

                                                window.location.href = redirectUrl;
                                            }}
                                            onError={(msg) => {
                                                setAuthError(msg);
                                                addToast(msg, "error");
                                            }}
                                        />
                                    )}

                                    {/* No Auth Providers Warning */}
                                    {displayedProviders.length === 0 && !authnEnabled && (
                                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                                            <p className="text-sm text-destructive text-center">
                                                {t("noAuthenticationProviders")}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </CardContent>

                <CardFooter>
                    <p className="text-xs text-muted-foreground text-center w-full">
                        {t("hint.agreeToTerms")}{" "}
                        <a
                            href="#"
                            className="font-medium text-foreground hover:text-primary underline-offset-4 hover:underline"
                        >
                            {t("hint.termsOfService")}
                        </a>{" "}
                        {t("hint.and")}{" "}
                        <a
                            href="#"
                            className="font-medium text-foreground hover:text-primary underline-offset-4 hover:underline"
                        >
                            {t("hint.personalData")}
                        </a>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
