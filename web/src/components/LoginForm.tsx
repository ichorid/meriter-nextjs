/**
 * Centralized Login Form Component
 *
 * Handles authentication methods:
 * - Multiple OAuth providers (Google, Yandex, VK, Telegram, Apple, Twitter, Instagram, Sber)
 * - Fake authentication (development mode)
 * - Error handling and loading states
 */

"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as LucideIcons from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/atoms/LoadingState";
import { handleAuthRedirect } from "@/lib/utils/auth";
import { getErrorMessage } from "@/lib/api/errors";
import { isFakeDataMode, config } from "@/config";
import {
    OAUTH_PROVIDERS,
    getOAuthUrl,
    type OAuthProvider,
} from "@/lib/utils/oauth-providers";
import {
    BrandFormControl,
    Logo,
} from "@/components/ui";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
import { Loader2 } from "lucide-react";
import { useToastStore } from "@/shared/stores/toast.store";
import { PasskeySection } from "./PasskeySection";

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
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations("login");
    const tReg = useTranslations("registration");
    const fakeDataMode = isFakeDataMode();

    console.log("login form test34");
    console.log("fakeDataMode", fakeDataMode);
    console.log("authnEnabled", authnEnabled);
    console.log("enabledProviders", enabledProviders);

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

    // Render OAuth provider icon
    const renderProviderIcon = (provider: OAuthProvider) => {
        const IconComponent = LucideIcons[
            provider.icon
        ] as React.ComponentType<{ className?: string; size?: number }>;
        if (!IconComponent) {
            return <LucideIcons.LogIn className="w-5 h-5" />;
        }
        return <IconComponent className="w-5 h-5" />;
    };

    return (
        <div className={`w-full max-w-md mx-auto ${className}`}>
            <div className="text-center mt-8 mb-24">
                <h1 className="text-xl font-normal text-base-content flex justify-center items-center gap-4">
                    <Logo size={40} className="text-base-content" />
                    <span>{t("siteTitle")}</span>
                </h1>
            </div>
            <div className="mb-4">
                <h2 className="text-2xl font-bold text-base-content text-left mb-6">
                    {t("title")}
                </h2>
            </div>

            <div className="space-y-4 mb-4">
                <p className="text-sm text-base-content/70 mb-8">
                    {t("subtitle")}
                </p>

                {isLoading && <LoadingState text={t("authenticating")} />}

                {!isLoading && (
                    <div className="space-y-4">
                        {fakeDataMode ? (
                            <div className="space-y-4 text-center">
                                <p className="text-sm text-base-content bg-warning/10 p-2 rounded-lg border border-warning/20">
                                    {t("fakeDataModeEnabled")}
                                </p>
                                <Button
                                    variant="default"
                                    size="lg"
                                    className="rounded-xl active:scale-[0.98] w-full"
                                    onClick={handleFakeAuth}
                                    disabled={isLoading}
                                >
                                    {t("fakeLogin")}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="rounded-xl active:scale-[0.98] w-full border-primary text-primary hover:bg-primary hover:text-primary-content"
                                    onClick={handleFakeSuperadminAuth}
                                    disabled={isLoading}
                                >
                                    {t("superadminLogin")}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {displayedProviders.length > 0 && displayedProviders.map((provider) => (
                                    <Button
                                        key={provider.id}
                                        variant="outline"
                                        size="md"
                                        className="rounded-xl active:scale-[0.98] w-full justify-start pl-6"
                                        onClick={() =>
                                            handleOAuthAuth(provider.id)
                                        }
                                        disabled={isLoading}
                                    >
                                        {t("signInWith", {
                                            provider: provider.name,
                                        })}
                                    </Button>
                                ))}

                                {authnEnabled && (
                                    <div>
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
                                    </div>
                                )}

                                {displayedProviders.length === 0 && !authnEnabled && (
                                    <div className="text-center p-4 bg-error/10 rounded-xl border border-error/20">
                                        <p className="text-sm text-error">
                                            {t("noAuthenticationProviders")}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="mt-8 text-left text-sm text-base-content/70">
                {t("hint.agreeToTerms")}{" "}
                <a
                    href="#"
                    className="font-medium text-base-content hover:text-brand-primary"
                >
                    {t("hint.termsOfService")}
                </a>{" "}
                {t("hint.and")}{" "}
                <a
                    href="#"
                    className="font-medium text-base-content hover:text-brand-primary"
                >
                    {t("hint.personalData")}
                </a>
            </div>
        </div>
    );
}
