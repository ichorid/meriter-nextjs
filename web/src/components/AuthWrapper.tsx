"use client";

import React, { useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCaptiveBrowser } from "@/lib/captive-browser";
import { LoginForm } from "@/components/LoginForm";
import { LoadingState } from "@/components/atoms/LoadingState";
import { safeMeriterReturnPath } from "@/lib/utils/safe-return-to";

interface AuthWrapperProps {
  children: React.ReactNode;
  enabledProviders?: string[];
  authnEnabled?: boolean;
  smsEnabled?: boolean;
  phoneEnabled?: boolean;
  emailEnabled?: boolean;
  botUsername?: string | null;
}

// Set to true to disable AuthWrapper temporarily for debugging
const DISABLE_AUTH_WRAPPER = false;

// Enable debug logging only in development
const DEBUG_MODE = process.env.NODE_ENV === "development";

const LOGIN_PATH = "/meriter/login";
const AUTH_RETURN_TO_KEY = "meriter.authReturnTo";

function currentMeriterPath(pathname: string | null, search: string | undefined): string {
  if (!pathname) return "";
  return `${pathname}${search ? `?${search}` : ""}`;
}

/**
 * Global Auth Wrapper Component
 *
 * Checks authentication status via /me request:
 * - If not authenticated: shows login page
 * - If authenticated but no invite used (and no roles): shows invite entry page
 * - If authenticated and valid: shows home or requested page
 */
function AuthWrapperComponent({
  children,
  enabledProviders,
  authnEnabled,
  smsEnabled,
  phoneEnabled,
  emailEnabled,
  botUsername,
}: AuthWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString();
  const { user: _user, isLoading, isAuthenticated } = useAuth();
  const { isCaptive: captiveBrowser } = useCaptiveBrowser();
  const redirectAttemptedRef = useRef<{ pathname: string; isAuthenticated: boolean } | null>(
    null,
  );

  const isLoginPage = pathname === LOGIN_PATH;
  const returnToParam = searchParams?.get("returnTo") ?? null;

  useEffect(() => {
    if (isLoading) return;

    if (isLoginPage && returnToParam) {
      const safe = safeMeriterReturnPath(returnToParam);
      if (safe) {
        sessionStorage.setItem(AUTH_RETURN_TO_KEY, safe);
      }
    }

    if (isAuthenticated) {
      const storedReturnTo = sessionStorage.getItem(AUTH_RETURN_TO_KEY);
      const safeStored = safeMeriterReturnPath(storedReturnTo);
      if (safeStored) {
        const here = currentMeriterPath(pathname, search);
        if (here !== safeStored) {
          sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
          if (DEBUG_MODE) {
            console.log("[AuthWrapper] Restoring returnTo from sessionStorage:", safeStored);
          }
          router.replace(safeStored);
          return;
        }
        sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
      }
    }

    if (isAuthenticated && isLoginPage) {
      if (
        redirectAttemptedRef.current &&
        redirectAttemptedRef.current.pathname === pathname &&
        redirectAttemptedRef.current.isAuthenticated === isAuthenticated
      ) {
        return;
      }

      redirectAttemptedRef.current = { pathname: pathname ?? LOGIN_PATH, isAuthenticated };

      const targetPath =
        safeMeriterReturnPath(returnToParam) ??
        safeMeriterReturnPath(sessionStorage.getItem(AUTH_RETURN_TO_KEY)) ??
        "/meriter/profile";

      sessionStorage.removeItem(AUTH_RETURN_TO_KEY);

      if (DEBUG_MODE) {
        console.log("[AuthWrapper] Redirect check:", {
          isAuthenticated,
          pathname,
          targetPath,
        });
        console.log("[AuthWrapper] Redirecting to", targetPath);
      }

      router.replace(targetPath);
      return;
    }

    if (!isAuthenticated && pathname && !pathname.startsWith("/api") && !isLoginPage) {
      const returnTo = encodeURIComponent(currentMeriterPath(pathname, search));
      router.replace(`${LOGIN_PATH}?returnTo=${returnTo}`);
    }

    if (pathname !== LOGIN_PATH && redirectAttemptedRef.current?.pathname === LOGIN_PATH) {
      redirectAttemptedRef.current = null;
    }
  }, [isAuthenticated, isLoading, isLoginPage, pathname, returnToParam, router, search]);

  if (DISABLE_AUTH_WRAPPER) {
    if (DEBUG_MODE) {
      console.log("[AuthWrapper] DISABLED - rendering children directly");
    }
    return <>{children}</>;
  }

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  if (!isAuthenticated) {
    if (pathname?.startsWith("/api")) {
      return <>{children}</>;
    }
    if (!isLoginPage) {
      return null;
    }
    return (
      <div className="min-h-screen bg-base-100 px-4 py-8 flex items-center justify-between flex-col min-h-screen">
        <LoginForm
          enabledProviders={enabledProviders}
          authnEnabled={authnEnabled}
          smsEnabled={smsEnabled}
          phoneEnabled={phoneEnabled}
          emailEnabled={emailEnabled}
          botUsername={botUsername}
          captiveBrowser={captiveBrowser}
        />
      </div>
    );
  }

  if (isLoginPage) {
    return null;
  }

  return <>{children}</>;
}

export const AuthWrapper = AuthWrapperComponent;
