"use client";

import React, { useEffect, useRef, useMemo, memo } from "react";
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
    // ALL HOOKS MUST BE CALLED FIRST - before any conditional returns
    const router = useRouter();
    const pathname = usePathname();
    const { user, isLoading, isAuthenticated } = useAuth();
    const renderCount = useRef(0);
    const lastLoggedPathname = useRef<string | null>(null);
    const redirectAttemptedRef = useRef<{ pathname: string; isAuthenticated: boolean } | null>(null);
    const renderLoopDetected = useRef(false);
    const lastDebugLogTime = useRef<number>(0);
    const renderTimestamps = useRef<number[]>([]);
    const lastStableStateRef = useRef<{
        pathname: string | null;
        isLoading: boolean;
        isAuthenticated: boolean;
        userId: string | undefined;
    } | null>(null);
    
    // Stabilize user object reference using useMemo to avoid expensive operations on every render
    const prevUserRef = useRef<{ user: typeof user; serialized: string } | null>(null);
    
    // Memoize user serialization to avoid running on every render
    const stableUser = useMemo(() => {
        if (!user) {
            prevUserRef.current = null;
            return null;
        }
        
        // Serialize key fields to detect actual changes
        const currentSerialized = JSON.stringify({ 
            id: user.id, 
            globalRole: user.globalRole, 
            inviteCode: user.inviteCode,
            membershipsLength: user.communityMemberships?.length 
        });
        
        // Return previous reference if values haven't changed
        if (prevUserRef.current && prevUserRef.current.serialized === currentSerialized) {
            return prevUserRef.current.user;
        }
        
        // Values changed, update ref and return new user
        prevUserRef.current = { user, serialized: currentSerialized };
        return user;
    }, [user]);

    // Extract primitive values directly - these are stable even if user object reference changes
    const userId = stableUser?.id;
    const userGlobalRole = stableUser?.globalRole;
    const userInviteCode = stableUser?.inviteCode;
    const userMembershipsCount = stableUser?.communityMemberships?.length ?? 0;

    // Debug logging with throttling to avoid performance impact
    useEffect(() => {
        if (!DEBUG_MODE) return;

        // Throttle debug logs to once per 500ms to avoid performance impact
        const now = Date.now();
        const timeSinceLastLog = now - lastDebugLogTime.current;
        const shouldLog = 
            pathname !== lastLoggedPathname.current ||
            renderCount.current === 1 ||
            timeSinceLastLog > 500;

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
                timestamp: new Date().toISOString(),
            };

            console.log("[AuthWrapper] Render:", debugInfo);
            lastLoggedPathname.current = pathname;
            lastDebugLogTime.current = now;

            // Check for potential infinite loop - lowered threshold
            if (renderCount.current > 15) {
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
                        },
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
    
    // Track render count and detect render loops - improved circuit breaker
    // Only detect loops when renders happen rapidly with the same state (not legitimate navigation)
    const currentState = {
        pathname,
        isLoading,
        isAuthenticated,
        userId: stableUser?.id,
    };
    
    // Check if state actually changed (legitimate render)
    const stateChanged = !lastStableStateRef.current || 
        lastStableStateRef.current.pathname !== currentState.pathname ||
        lastStableStateRef.current.isLoading !== currentState.isLoading ||
        lastStableStateRef.current.isAuthenticated !== currentState.isAuthenticated ||
        lastStableStateRef.current.userId !== currentState.userId;
    
    // If state changed, reset render tracking (legitimate render)
    if (stateChanged) {
        renderCount.current = 0;
        renderTimestamps.current = [];
        lastStableStateRef.current = currentState;
    } else {
        // State didn't change - this might be a loop
        renderCount.current += 1;
        const now = Date.now();
        renderTimestamps.current.push(now);
        
        // Keep only timestamps from last 1 second
        renderTimestamps.current = renderTimestamps.current.filter(ts => now - ts < 1000);
        
        // Detect loop: more than 5 renders in 1 second with same state
        if (renderTimestamps.current.length > 5 && !renderLoopDetected.current) {
            renderLoopDetected.current = true;
            if (DEBUG_MODE) {
                console.error("[AuthWrapper] CRITICAL: Render loop detected! Component will return loading state to prevent crash.");
                console.error("[AuthWrapper] Current values:", {
                    ...currentState,
                    renderCount: renderCount.current,
                    rendersInLastSecond: renderTimestamps.current.length,
                });
            }
        }
    }
    
    // If render loop detected, return early with loading state
    // This check happens after hooks but before expensive operations
    if (renderLoopDetected.current) {
        return <LoadingState fullScreen />;
    }

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

// Memoize AuthWrapper with custom comparison to prevent re-renders when props haven't changed
// Note: We don't compare children as it's often a new reference, but we do compare the actual config props
// Context changes will still cause re-renders, but this prevents unnecessary re-renders from prop changes
const AuthWrapperMemoized = memo(AuthWrapperComponent, (prevProps, nextProps) => {
    // Compare arrays by serialization since array references might differ
    const prevProvidersStr = JSON.stringify(prevProps.enabledProviders?.sort() || []);
    const nextProvidersStr = JSON.stringify(nextProps.enabledProviders?.sort() || []);
    
    // Only re-render if actual config props change (not children, which is often a new reference)
    return (
        prevProvidersStr === nextProvidersStr &&
        prevProps.authnEnabled === nextProps.authnEnabled
    );
});

export const AuthWrapper = AuthWrapperMemoized;
