"use client";

import React, { useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { LoadingState } from "@/components/atoms/LoadingState";

interface AuthWrapperProps {
    children: React.ReactNode;
    enabledProviders?: string[];
    authnEnabled?: boolean;
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
export function AuthWrapper({ children, enabledProviders, authnEnabled }: AuthWrapperProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isLoading, isAuthenticated } = useAuth();
    const renderCount = useRef(0);
    const lastLoggedPathname = useRef<string | null>(null);
    const redirectAttemptedRef = useRef<string | null>(null);

    if (DEBUG_MODE) {
        renderCount.current += 1;
    }

    // Memoize extracted user properties to prevent recalculation on every render
    // This ensures stable references when user object reference changes but values don't
    const userId = useMemo(() => user?.id, [user?.id]);
    const userGlobalRole = useMemo(() => user?.globalRole, [user?.globalRole]);
    const userInviteCode = useMemo(() => user?.inviteCode, [user?.inviteCode]);
    // Use nullish coalescing to handle undefined consistently
    const userMembershipsCount = useMemo(
        () => user?.communityMemberships?.length ?? 0,
        [user?.communityMemberships?.length ?? 0]
    );

    // Reset redirect tracking when pathname changes (allows redirects on new navigation)
    useEffect(() => {
        if (pathname !== redirectAttemptedRef.current) {
            redirectAttemptedRef.current = null;
        }
    }, [pathname]);

    // Optimized debug logging - only log when meaningful values change
    useEffect(() => {
        if (!DEBUG_MODE) return;

        // Only log when pathname changes or on significant state changes
        const shouldLog =
            pathname !== lastLoggedPathname.current ||
            renderCount.current === 1;

        if (shouldLog) {
            const debugInfo = {
                renderCount: renderCount.current,
                pathname,
                isLoading,
                isAuthenticated,
                hasUser: !!user,
                userId,
                userInviteCode,
                userMemberships: userMembershipsCount,
                userGlobalRole,
                timestamp: new Date().toISOString(),
            };

            console.log("[AuthWrapper] Render:", debugInfo);
            lastLoggedPathname.current = pathname;

            // Check for potential infinite loop
            if (renderCount.current > 50) {
                console.error(
                    "[AuthWrapper] WARNING: Excessive renders detected!",
                    debugInfo
                );
            }
        }
    }, [
        pathname,
        isLoading,
        isAuthenticated,
        userId,
        userGlobalRole,
        userInviteCode,
        userMembershipsCount,
        user,
    ]);

    // If authenticated and on login page, redirect to home
    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    // Use ref to prevent multiple redirect attempts on the same pathname
    useEffect(() => {
        if (isAuthenticated && pathname === "/meriter/login") {
            // Prevent multiple redirect attempts for the same pathname
            if (redirectAttemptedRef.current === pathname) {
                return;
            }
            
            redirectAttemptedRef.current = pathname;
            
            if (DEBUG_MODE) {
                console.log("[AuthWrapper] Redirect check:", {
                    isAuthenticated,
                    pathname,
                });
                console.log("[AuthWrapper] Redirecting to /meriter/profile");
            }
            
            router.push("/meriter/profile");
        }
    }, [isAuthenticated, pathname, router]);

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
                <LoginForm enabledProviders={enabledProviders} authnEnabled={authnEnabled} />
            </div>
        );
    }

    // If authenticated, show children (invite codes are now optional)
    return <>{children}</>;
}
