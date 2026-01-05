"use client";

import React, { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { LoadingState } from "@/components/atoms/LoadingState";

interface AuthWrapperProps {
    children: React.ReactNode;
    enabledProviders?: string[];
    authnEnabled?: boolean;
    smsEnabled?: boolean;
    phoneEnabled?: boolean;
    emailEnabled?: boolean;
}

// Set to true to disable AuthWrapper temporarily for debugging
const DISABLE_AUTH_WRAPPER = false;

// Enable debug logging only in development
const DEBUG_MODE = process.env.NODE_ENV === "development";

/**
 * Global Auth Wrapper Component
 *
 * Checks authentication status via /me request:
 * - If not authenticated: shows login page
 * - If authenticated but no invite used (and no roles): shows invite entry page
 * - If authenticated and valid: shows home or requested page
 */
function AuthWrapperComponent({ children, enabledProviders, authnEnabled, smsEnabled, phoneEnabled, emailEnabled }: AuthWrapperProps) {
    // ALL HOOKS MUST BE CALLED FIRST - before any conditional returns
    const router = useRouter();
    const pathname = usePathname();
    const { user, isLoading, isAuthenticated } = useAuth();
    const redirectAttemptedRef = useRef<{ pathname: string; isAuthenticated: boolean } | null>(null);

    // If authenticated and on login page, redirect to home
    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    // Use ref to prevent multiple redirect attempts by tracking both pathname AND isAuthenticated state
    useEffect(() => {
        const targetPath = "/meriter/profile";

        // Only redirect if authenticated and on login page
        if (isAuthenticated && pathname === "/meriter/login") {
            // Prevent multiple redirect attempts for the same pathname + auth state combination
            if (redirectAttemptedRef.current &&
                redirectAttemptedRef.current.pathname === pathname &&
                redirectAttemptedRef.current.isAuthenticated === isAuthenticated) {
                return;
            }

            redirectAttemptedRef.current = { pathname, isAuthenticated };

            if (DEBUG_MODE) {
                console.log("[AuthWrapper] Redirect check:", {
                    isAuthenticated,
                    pathname,
                    targetPath,
                });
                console.log("[AuthWrapper] Redirecting to", targetPath);
            }

            router.push(targetPath);
        }

        // Clear redirect tracking when pathname changes to a different route
        // This allows redirects on new navigation but prevents loops
        if (pathname !== "/meriter/login" && redirectAttemptedRef.current?.pathname === "/meriter/login") {
            redirectAttemptedRef.current = null;
        }
    }, [isAuthenticated, pathname]); // Removed router from deps - Next.js 13+ router is stable

    // NOW ALL HOOKS ARE CALLED - safe to do conditional logic and early returns

    // If disabled, just render children
    // This conditional return is AFTER all hooks have been called
    if (DISABLE_AUTH_WRAPPER) {
        if (DEBUG_MODE) {
            console.log("[AuthWrapper] DISABLED - rendering children directly");
        }
        return <>{children}</>;
    }

    // If loading, show loading state
    if (isLoading) {
        return <LoadingState fullScreen />;
    }

    // If not authenticated, show login page (regardless of route, unless it's a public API)
    if (!isAuthenticated && !pathname?.startsWith("/api")) {
        return (
            <div className="min-h-screen bg-base-100 px-4 py-8 flex items-center justify-between flex-col min-h-screen">
                <LoginForm
                    enabledProviders={enabledProviders}
                    authnEnabled={authnEnabled}
                    smsEnabled={smsEnabled}
                    phoneEnabled={phoneEnabled}
                    emailEnabled={emailEnabled}
                />
            </div>
        );
    }

    // If authenticated, show children (invite codes are now optional)
    return <>{children}</>;
}

export const AuthWrapper = AuthWrapperComponent;
