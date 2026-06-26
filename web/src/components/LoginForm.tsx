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

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/atoms/LoadingState";
import { getErrorMessage } from "@/lib/api/errors";
import { safeMeriterReturnPath } from "@/lib/utils/safe-return-to";
import { isFakeDataMode, isTestAuthMode } from "@/config";
import { EMAIL_ONLY_LOGIN } from "@/lib/constants/login-methods";
import { mockOAuthAuth } from "@/lib/utils/mock-auth";
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
import { Input } from "@/components/ui/shadcn/input";
import { BrandFormControl } from "@/components/ui";
import { Phone, Mail } from "lucide-react";
import { resolveApiErrorToastMessage } from "@/lib/i18n/api-error-toast";
import { useToastStore } from "@/shared/stores/toast.store";
import { PasskeySection } from "./PasskeySection";
import { OAuthButton } from "./OAuthButton";
import { TelegramLoginWidget } from "./TelegramLoginWidget";
import { SmsAuthDialog } from "./SmsAuthDialog";
import { CallCheckAuthDialog } from "./CallCheckAuthDialog";
import { EmailAuthDialog, type EmailLinkSentInfo } from "./EmailAuthDialog";
import { CheckEmailCard } from "./CheckEmailCard";

interface LoginFormProps {
    className?: string;
    enabledProviders?: string[];
    authnEnabled?: boolean;
    smsEnabled?: boolean;
    phoneEnabled?: boolean;
    emailEnabled?: boolean;
    botUsername?: string | null;
    /** When true (in-app/captive browser), show only SMS and Email and a banner to open in system browser */
    captiveBrowser?: boolean;
}

export function LoginForm({
    className = "",
    enabledProviders,
    authnEnabled = false,
    smsEnabled = false,
    phoneEnabled = false,
    emailEnabled = false,
    botUsername = null,
    captiveBrowser = false,
}: LoginFormProps) {
    const searchParams = useSearchParams();
    const t = useTranslations("login");
    const tReg = useTranslations("registration");
    const fakeDataMode = isFakeDataMode();
    const testAuthMode = isTestAuthMode();

    // Production UI: email + optional Telegram from runtime config.
    const resolvedProviders = testAuthMode
        ? enabledProviders
        : enabledProviders ?? EMAIL_ONLY_LOGIN.enabledProviders;
    const resolvedAuthn = testAuthMode ? authnEnabled : EMAIL_ONLY_LOGIN.authnEnabled;
    const resolvedSms = testAuthMode ? smsEnabled : EMAIL_ONLY_LOGIN.smsEnabled;
    const resolvedPhone = testAuthMode ? phoneEnabled : EMAIL_ONLY_LOGIN.phoneEnabled;
    const resolvedEmail = emailEnabled;

    const { authenticateFakeUser, authenticateFakeSuperadmin, isLoading, authError, setAuthError } =
        useAuth();
    const addToast = useToastStore((state) => state.addToast);

    // Local loading state for OAuth authentication
    const [isOAuthLoading, setIsOAuthLoading] = useState(false);

    // State for auth dialogs
    const [smsDialogOpen, setSmsDialogOpen] = useState(false);
    const [callDialogOpen, setCallDialogOpen] = useState(false);
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);

    // When set, the sign-in link email was sent and the "check your email"
    // screen replaces the login card until the user clicks the link or goes back.
    const [emailLinkSent, setEmailLinkSent] = useState<EmailLinkSentInfo | null>(null);

    // Get return URL from URL
    const returnTo = searchParams?.get("returnTo");

    const welcomeUrlForNewUser = (): string => {
        const safe = safeMeriterReturnPath(returnTo);
        if (safe) {
            return `/meriter/welcome?returnTo=${encodeURIComponent(safe)}`;
        }
        return "/meriter/welcome";
    };

    // Filter providers if enabledProviders is passed
    const displayedProviders = resolvedProviders
        ? OAUTH_PROVIDERS.filter((p) => resolvedProviders.includes(p.id))
        : OAUTH_PROVIDERS;

    const hasTelegramLogin =
        !testAuthMode &&
        !captiveBrowser &&
        displayedProviders.some((p) => p.id === 'telegram') &&
        Boolean(botUsername);

    const hasPrimaryAuthColumn =
        displayedProviders.filter((p) => p.id !== 'telegram').length > 0 ||
        hasTelegramLogin ||
        resolvedSms ||
        resolvedPhone ||
        resolvedEmail;
    const showNoAuthProvidersWarning =
        displayedProviders.filter((p) => p.id !== 'telegram').length === 0 &&
        !hasTelegramLogin &&
        !resolvedAuthn &&
        !resolvedSms &&
        !resolvedPhone &&
        !resolvedEmail;

    // Show auth error toast when error changes
    useEffect(() => {
        if (authError) {
            addToast(resolveApiErrorToastMessage(authError), "error");
        }
    }, [authError, addToast]);

    // Magic link redeem failure redirects here with ?error=link_expired
    const urlError = searchParams?.get("error");
    useEffect(() => {
        if (urlError === "link_expired") {
            addToast(t("linkExpired"), "error");
        }
    }, [urlError, addToast, t]);

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
            addToast(resolveApiErrorToastMessage(message), "error");
        }
    };

    // Handle OAuth provider authentication
    const handleOAuthAuth = async (providerId: string) => {
        if (testAuthMode) {
            // In test auth mode, use mock authentication
            try {
                setIsOAuthLoading(true);
                setAuthError(null);
                const result = await mockOAuthAuth(providerId);
                
                // Set JWT cookie manually (in test mode, backend will accept mock tokens)
                document.cookie = `jwt=${result.jwt}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
                
                // Redirect based on isNewUser
                let redirectUrl = buildRedirectUrl();
                if (result.isNewUser) {
                    redirectUrl = welcomeUrlForNewUser();
                }
                
                // Reload to trigger auth context update
                window.location.href = redirectUrl;
            } catch (error: unknown) {
                const message = getErrorMessage(error);
                setAuthError(message);
                addToast(resolveApiErrorToastMessage(message), "error");
                setIsOAuthLoading(false);
            }
        } else {
            // Normal OAuth flow
            const returnToPath = buildRedirectUrl();
            const oauthUrl = getOAuthUrl(providerId, returnToPath);
            window.location.href = oauthUrl;
        }
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

            {/* "Check your email" screen after the sign-in link was sent */}
            {emailLinkSent ? (
                <CheckEmailCard
                    email={emailLinkSent.email}
                    canResendAt={emailLinkSent.canResendAt}
                    onBack={() => setEmailLinkSent(null)}
                    onLoggedIn={() => {
                        window.location.href = buildRedirectUrl();
                    }}
                />
            ) : (
            <Card>
                <CardHeader>
                    <CardTitle>{t("title")}</CardTitle>
                    <CardDescription>{t("subtitle")}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {(isLoading || isOAuthLoading) && <LoadingState text={t("authenticating")} />}

                    {!(isLoading || isOAuthLoading) && (
                        <>
                            <div className="space-y-4">
                                {/* In test auth mode, show all providers for testing */}
                                {testAuthMode ? (
                                    <div className="space-y-2">
                                        {/* Show all OAuth providers in test mode */}
                                        {OAUTH_PROVIDERS.map((provider) => (
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
                                        
                                        {/* Show all auth methods in test mode */}
                                        <Button
                                            variant="outline"
                                            className="w-full justify-center"
                                            onClick={() => setSmsDialogOpen(true)}
                                            disabled={isLoading || isOAuthLoading}
                                        >
                                            <Phone className="mr-2 h-4 w-4" />
                                            {t("signInWithSms")}
                                        </Button>

                                        <Button
                                            variant="outline"
                                            className="w-full justify-center"
                                            onClick={() => setCallDialogOpen(true)}
                                            disabled={isLoading || isOAuthLoading}
                                        >
                                            <Phone className="mr-2 h-4 w-4" />
                                            {t("signInWithCall")}
                                        </Button>

                                        <Button
                                            variant="outline"
                                            className="w-full justify-center"
                                            onClick={() => setEmailDialogOpen(true)}
                                            disabled={isLoading || isOAuthLoading}
                                        >
                                            <Mail className="mr-2 h-4 w-4" />
                                            {t("signInWithEmail")}
                                        </Button>

                                        {/* Passkey in test mode */}
                                        <PasskeySection
                                            isLoading={isLoading || isOAuthLoading}
                                            onSuccess={(result) => {
                                                let redirectUrl = buildRedirectUrl();
                                                if (result?.isNewUser) {
                                                    redirectUrl = welcomeUrlForNewUser();
                                                }
                                                window.location.href = redirectUrl;
                                            }}
                                            onError={(msg) => {
                                                setAuthError(msg);
                                                addToast(resolveApiErrorToastMessage(msg), "error");
                                            }}
                                        />
                                    </div>
                                ) : captiveBrowser ? (
                                    <>
                                        {/* Captive (in-app) browser: only SMS and Email (tg-hint overlay handles instructions) */}
                                        <div className="space-y-2">
                                            {resolvedSms && (
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-center"
                                                    onClick={() => setSmsDialogOpen(true)}
                                                    disabled={isLoading || isOAuthLoading}
                                                >
                                                    <Phone className="mr-2 h-4 w-4" />
                                                    {t("signInWithSms")}
                                                </Button>
                                            )}
                                            {resolvedEmail && (
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-center"
                                                    onClick={() => setEmailDialogOpen(true)}
                                                    disabled={isLoading || isOAuthLoading}
                                                >
                                                    <Mail className="mr-2 h-4 w-4" />
                                                    {t("signInWithEmail")}
                                                </Button>
                                            )}
                                            {(!resolvedSms && !resolvedEmail) && (
                                                <p className="text-sm text-muted-foreground text-center">
                                                    {t("noAuthenticationProviders")}
                                                </p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                    {/* OAuth + phone/email (phone/email independent of OAuth) */}
                                    {hasPrimaryAuthColumn && (
                                        <div className="space-y-2">
                                            {displayedProviders
                                                .filter((provider) => provider.id !== 'telegram')
                                                .map((provider) => (
                                                <OAuthButton
                                                    key={provider.id}
                                                    provider={provider}
                                                    onClick={() => handleOAuthAuth(provider.id)}
                                                    disabled={isLoading || isOAuthLoading}
                                                    label={t("signInWith", {
                                                        provider: provider.name,
                                                    })}
                                                />
                                            ))}

                                            {hasTelegramLogin && botUsername && (
                                                <TelegramLoginWidget
                                                    botUsername={botUsername}
                                                    disabled={isLoading || isOAuthLoading}
                                                    onSuccess={(result) => {
                                                        let redirectUrl = buildRedirectUrl();
                                                        if (result.isNewUser) {
                                                            redirectUrl = '/meriter/welcome/link-account';
                                                            const safe = safeMeriterReturnPath(returnTo);
                                                            if (safe) {
                                                                redirectUrl += `?returnTo=${encodeURIComponent(safe)}`;
                                                            }
                                                        }
                                                        window.location.href = redirectUrl;
                                                    }}
                                                    onError={(msg) => {
                                                        setAuthError(msg);
                                                        addToast(resolveApiErrorToastMessage(msg), "error");
                                                    }}
                                                />
                                            )}

                                            {resolvedSms && (
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-center"
                                                    onClick={() => setSmsDialogOpen(true)}
                                                    disabled={isLoading || isOAuthLoading}
                                                >
                                                    <Phone className="mr-2 h-4 w-4" />
                                                    {t("signInWithSms")}
                                                </Button>
                                            )}

                                            {resolvedPhone && (
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-center"
                                                    onClick={() => setCallDialogOpen(true)}
                                                    disabled={isLoading || isOAuthLoading}
                                                >
                                                    <Phone className="mr-2 h-4 w-4" />
                                                    {t("signInWithCall")}
                                                </Button>
                                            )}

                                            {resolvedEmail && (
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-center"
                                                    onClick={() => setEmailDialogOpen(true)}
                                                    disabled={isLoading || isOAuthLoading}
                                                >
                                                    <Mail className="mr-2 h-4 w-4" />
                                                    {t("signInWithEmail")}
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {/* Separator between primary methods and Passkey */}
                                    {hasPrimaryAuthColumn && resolvedAuthn && (
                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <Separator />
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-card px-2 text-muted-foreground">
                                                    {t("orContinueWith")}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Passkey Authentication */}
                                    {resolvedAuthn && (
                                        <PasskeySection
                                            isLoading={isLoading || isOAuthLoading}
                                            onSuccess={(result) => {
                                                let redirectUrl = buildRedirectUrl();

                                                // Force welcome page for new users
                                                if (result?.isNewUser) {
                                                    redirectUrl = welcomeUrlForNewUser();
                                                }

                                                window.location.href = redirectUrl;
                                            }}
                                            onError={(msg) => {
                                                setAuthError(msg);
                                                addToast(resolveApiErrorToastMessage(msg), "error");
                                            }}
                                        />
                                    )}

                                        {/* No Auth Providers Warning */}
                                        {showNoAuthProvidersWarning && (
                                            <div className="bg-destructive/10 shadow-none rounded-lg p-4">
                                                <p className="text-sm text-destructive text-center">
                                                    {t("noAuthenticationProviders")}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}

                                    {/* Fake Data Mode Authentication */}
                                    {fakeDataMode && (
                                        <div className="space-y-2 pt-4 border-t">
                                            <p className="text-xs text-muted-foreground text-center mb-2">
                                                {t("fakeDataModeEnabled")}
                                            </p>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-center"
                                                onClick={handleFakeAuth}
                                                disabled={isLoading || isOAuthLoading}
                                            >
                                                {t("fakeLogin")}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-center"
                                                onClick={handleFakeSuperadminAuth}
                                                disabled={isLoading || isOAuthLoading}
                                            >
                                                {t("superadminLogin")}
                                            </Button>
                                        </div>
                                    )}
                                </div>
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
            )}

            {/* SMS Authentication Dialog - always available in test mode */}
            {(resolvedSms || testAuthMode) && (
                <SmsAuthDialog
                    open={smsDialogOpen}
                    onOpenChange={setSmsDialogOpen}
                    onSuccess={(result) => {
                        let redirectUrl = buildRedirectUrl();

                        // Force welcome page for new users
                        if (result?.isNewUser) {
                            redirectUrl = welcomeUrlForNewUser();
                        }

                        window.location.href = redirectUrl;
                    }}
                    onError={(msg) => {
                        setAuthError(msg);
                        addToast(resolveApiErrorToastMessage(msg), "error");
                    }}
                />
            )}

            {/* Phone/Call Authentication Dialog - always available in test mode */}
            {(resolvedPhone || testAuthMode) && (
                <CallCheckAuthDialog
                    open={callDialogOpen}
                    onOpenChange={setCallDialogOpen}
                    onSuccess={(result) => {
                        let redirectUrl = buildRedirectUrl();
                        if (result?.isNewUser) redirectUrl = welcomeUrlForNewUser();
                        window.location.href = redirectUrl;
                    }}
                    onError={(msg) => {
                        setAuthError(msg);
                        addToast(resolveApiErrorToastMessage(msg), "error");
                    }}
                />
            )}

            {/* Email Authentication Dialog - always available in test mode */}
            {(resolvedEmail || testAuthMode) && (
                <EmailAuthDialog
                    open={emailDialogOpen}
                    onOpenChange={setEmailDialogOpen}
                    onLinkSent={(info) => setEmailLinkSent(info)}
                    onSuccess={(result) => {
                        let redirectUrl = buildRedirectUrl();
                        if (result?.isNewUser) redirectUrl = welcomeUrlForNewUser();
                        window.location.href = redirectUrl;
                    }}
                    onError={(msg) => {
                        setAuthError(msg);
                        addToast(resolveApiErrorToastMessage(msg), "error");
                    }}
                />
            )}
        </div>
    );
}
