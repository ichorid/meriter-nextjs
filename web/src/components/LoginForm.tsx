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
import { isFakeDataMode, isTestAuthMode } from "@/config";
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
import { ChevronDown, ChevronUp, Phone, Mail } from "lucide-react";
import { useToastStore } from "@/shared/stores/toast.store";
import { PasskeySection } from "./PasskeySection";
import { OAuthButton } from "./OAuthButton";
import { SmsAuthDialog } from "./SmsAuthDialog";
import { CallCheckAuthDialog } from "./CallCheckAuthDialog";
import { EmailAuthDialog } from "./EmailAuthDialog";

interface LoginFormProps {
    className?: string;
    enabledProviders?: string[];
    authnEnabled?: boolean;
    smsEnabled?: boolean;
    phoneEnabled?: boolean;
    emailEnabled?: boolean;
}

export function LoginForm({
    className = "",
    enabledProviders,
    authnEnabled = false,
    smsEnabled = false,
    phoneEnabled = false,
    emailEnabled = false,
}: LoginFormProps) {
    const searchParams = useSearchParams();
    const t = useTranslations("login");
    const tReg = useTranslations("registration");
    const fakeDataMode = isFakeDataMode();
    const testAuthMode = isTestAuthMode();

    const { authenticateFakeUser, authenticateFakeSuperadmin, isLoading, authError, setAuthError } =
        useAuth();
    const addToast = useToastStore((state) => state.addToast);

    // Local loading state for OAuth authentication
    const [isOAuthLoading, setIsOAuthLoading] = useState(false);

    // State for invite code input
    const [inviteCode, setInviteCode] = useState("");
    const [inviteCodeExpanded, setInviteCodeExpanded] = useState(false);

    console.log("LoginForm", enabledProviders, authnEnabled, smsEnabled);

    // State for auth dialogs
    const [smsDialogOpen, setSmsDialogOpen] = useState(false);
    const [callDialogOpen, setCallDialogOpen] = useState(false);
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);

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

    // Helper function to construct redirect URL with invite code if present
    const buildRedirectUrl = (): string => {
        const baseUrl = returnTo || "/meriter/profile";

        // If invite code is present, append it as a query parameter
        if (inviteCode.trim()) {
            try {
                // Parse the base URL to handle existing query parameters
                const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost");
                url.searchParams.set("invite", inviteCode.trim());
                // Return pathname + search (relative URL)
                return url.pathname + url.search;
            } catch (e) {
                // If URL parsing fails (e.g., relative path without origin), use simple concatenation
                const separator = baseUrl.includes("?") ? "&" : "?";
                return `${baseUrl}${separator}invite=${encodeURIComponent(inviteCode.trim())}`;
            }
        }

        return baseUrl;
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
                    redirectUrl = "/meriter/welcome";
                }
                
                // Reload to trigger auth context update
                window.location.href = redirectUrl;
            } catch (error: unknown) {
                const message = getErrorMessage(error);
                setAuthError(message);
                addToast(message, "error");
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

            {/* Login Card */}
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
                                ) : (
                                    <>
                                    {/* OAuth Providers */}
                                    {displayedProviders.length > 0 && (
                                        <div className="space-y-2">
                                            {displayedProviders.map((provider) => (
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

                                            {smsEnabled && (
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

                                            {phoneEnabled && (
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

                                            {emailEnabled && (
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
                                            isLoading={isLoading || isOAuthLoading}
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
                                            <div className="bg-destructive/10 shadow-none rounded-lg p-4">
                                                <p className="text-sm text-destructive text-center">
                                                    {t("noAuthenticationProviders")}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Collapsible Invite Code Input - always visible */}
                                <div className="border rounded-lg overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setInviteCodeExpanded(!inviteCodeExpanded)}
                                        className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                                    >
                                        <div className="text-sm font-medium">{tReg("inviteCodeLabel")}</div>
                                        {inviteCodeExpanded ? (
                                            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                                        )}
                                    </button>
                                    {inviteCodeExpanded && (
                                        <div className="px-4 pb-4 pt-2 border-t space-y-3">
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                {tReg("inviteDescription")}
                                            </p>
                                            <BrandFormControl
                                                label={undefined}
                                                error={undefined}
                                            >
                                                <Input
                                                    value={inviteCode}
                                                    onChange={(e) => setInviteCode(e.target.value)}
                                                    placeholder={tReg("inviteCodePlaceholder")}
                                                    autoCapitalize="none"
                                                    autoComplete="off"
                                                    className="h-11 rounded-xl w-full"
                                                />
                                            </BrandFormControl>
                                        </div>
                                    )}
                                </div>
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

            {/* SMS Authentication Dialog - always available in test mode */}
            {(smsEnabled || testAuthMode) && (
                <SmsAuthDialog
                    open={smsDialogOpen}
                    onOpenChange={setSmsDialogOpen}
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

            {/* Phone/Call Authentication Dialog - always available in test mode */}
            {(phoneEnabled || testAuthMode) && (
                <CallCheckAuthDialog
                    open={callDialogOpen}
                    onOpenChange={setCallDialogOpen}
                    onSuccess={(result) => {
                        let redirectUrl = buildRedirectUrl();
                        if (result?.isNewUser) redirectUrl = "/meriter/welcome";
                        window.location.href = redirectUrl;
                    }}
                    onError={(msg) => {
                        setAuthError(msg);
                        addToast(msg, "error");
                    }}
                />
            )}

            {/* Email Authentication Dialog - always available in test mode */}
            {(emailEnabled || testAuthMode) && (
                <EmailAuthDialog
                    open={emailDialogOpen}
                    onOpenChange={setEmailDialogOpen}
                    onSuccess={(result) => {
                        let redirectUrl = buildRedirectUrl();
                        if (result?.isNewUser) redirectUrl = "/meriter/welcome";
                        window.location.href = redirectUrl;
                    }}
                    onError={(msg) => {
                        setAuthError(msg);
                        addToast(msg, "error");
                    }}
                />
            )}
        </div>
    );
}
