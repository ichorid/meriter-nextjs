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
function AuthWrapperComponent({ children, enabledProviders, authnEnabled }: AuthWrapperProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isLoading, isAuthenticated } = useAuth();
    const renderCount = useRef(0);
    const lastLoggedPathname = useRef<string | null>(null);
    const redirectAttemptedRef = useRef<string | null>(null);
    const renderLoopDetected = useRef(false);
    
    // Track previous values to detect what's actually changing
    const prevRenderValues = useRef<{
        pathname: string;
        isLoading: boolean;
        isAuthenticated: boolean;
        userId: string | undefined;
    } | null>(null);

    if (DEBUG_MODE) {
        renderCount.current += 1;
        
        // Safety check: if we detect excessive renders, prevent further processing
        if (renderCount.current > 100 && !renderLoopDetected.current) {
            renderLoopDetected.current = true;
            console.error("[AuthWrapper] CRITICAL: Render loop detected! Component will return loading state to prevent crash.");
            console.error("[AuthWrapper] Previous values:", prevRenderValues.current);
            console.error("[AuthWrapper] Current values:", {
                pathname,
                isLoading,
                isAuthenticated,
                userId: user?.id,
            });
        }
    }
    
    // If render loop detected, return early with loading state
    if (renderLoopDetected.current) {
        return <LoadingState fullScreen />;
    }
    
    // Update previous values for next comparison
    const currentUserId = user?.id;
    if (prevRenderValues.current) {
        const changed = {
            pathname: prevRenderValues.current.pathname !== pathname,
            isLoading: prevRenderValues.current.isLoading !== isLoading,
            isAuthenticated: prevRenderValues.current.isAuthenticated !== isAuthenticated,
            userId: prevRenderValues.current.userId !== currentUserId,
        };
        
        if (DEBUG_MODE && renderCount.current <= 10) {
            const hasChanges = Object.values(changed).some(v => v);
            if (hasChanges) {
                console.log("[AuthWrapper] Values changed:", changed);
            }
        }
    }
    prevRenderValues.current = {
        pathname,
        isLoading,
        isAuthenticated,
        userId: currentUserId,
    };

    // Stabilize user object reference using ref-based comparison
    // This prevents re-renders when user object reference changes but values don't
    const prevUserRef = useRef<{ user: typeof user; serialized: string } | null>(null);
    
    // Compare current user with previous by serializing key fields
    const currentSerialized = user ? JSON.stringify({ 
        id: user.id, 
        globalRole: user.globalRole, 
        inviteCode: user.inviteCode,
        membershipsLength: user.communityMemberships?.length 
    }) : 'null';
    
    // Use previous user reference if values haven't changed
    const stableUser = prevUserRef.current && prevUserRef.current.serialized === currentSerialized
        ? prevUserRef.current.user
        : user;
    
    // Update ref if user actually changed
    if (!prevUserRef.current || prevUserRef.current.serialized !== currentSerialized) {
        prevUserRef.current = { user, serialized: currentSerialized };
    }

    // Extract primitive values directly - these are stable even if user object reference changes
    const userId = stableUser?.id;
    const userGlobalRole = stableUser?.globalRole;
    const userInviteCode = stableUser?.inviteCode;
    const userMembershipsCount = stableUser?.communityMemberships?.length ?? 0;

    // Reset redirect tracking when pathname changes (allows redirects on new navigation)
    useEffect(() => {
        if (pathname !== redirectAttemptedRef.current) {
            redirectAttemptedRef.current = null;
        }
    }, [pathname]);

    // Track what changed to help debug render loops
    const prevValuesRef = useRef<{
        pathname: string;
        isLoading: boolean;
        isAuthenticated: boolean;
        userId: string | undefined;
        userGlobalRole: string | undefined;
        userInviteCode: string | undefined;
        userMembershipsCount: number;
    } | null>(null);

    // Optimized debug logging - only log when meaningful values change
    useEffect(() => {
        if (!DEBUG_MODE) return;

        const currentValues = {
            pathname,
            isLoading,
            isAuthenticated,
            userId,
            userGlobalRole,
            userInviteCode,
            userMembershipsCount,
        };

        // Determine what changed - always update ref for next comparison
        const changed = prevValuesRef.current
            ? Object.entries(currentValues).filter(
                  ([key, value]) => {
                      const prevValue = prevValuesRef.current![key as keyof typeof currentValues];
                      return prevValue !== value;
                  }
              ).map(([key]) => key)
            : ['initial'];

        // Always update ref for next comparison, even if we don't log
        prevValuesRef.current = currentValues;

        // Only log when pathname changes or on significant state changes
        const shouldLog =
            pathname !== lastLoggedPathname.current ||
            renderCount.current === 1 ||
            (changed.length > 0 && !changed.every(k => k === 'timestamp'));

        if (shouldLog) {
            const debugInfo = {
                renderCount: renderCount.current,
                pathname,
                isLoading,
                isAuthenticated,
                hasUser: !!userId,
                userId,
                userInviteCode,
                userMemberships: userMembershipsCount,
                userGlobalRole,
                changed,
                timestamp: new Date().toISOString(),
            };

            console.log("[AuthWrapper] Render:", debugInfo);
            lastLoggedPathname.current = pathname;

            // Check for potential infinite loop
            if (renderCount.current > 50) {
                console.error(
                    "[AuthWrapper] WARNING: Excessive renders detected!",
                    {
                        ...debugInfo,
                        allDeps: {
                            pathname,
                            isLoading,
                            isAuthenticated,
                            userId,
                            userGlobalRole,
                            userInviteCode,
                            userMembershipsCount,
                        }
                    }
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

// Export AuthWrapper directly (React.memo removed as it doesn't help with context-based re-renders)
// The component uses hooks (useAuth, useRouter, usePathname) which will cause re-renders
// regardless of props when context/state changes
export const AuthWrapper = AuthWrapperComponent;
