'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/shadcn/button';
import { X, User, Shield, LogOut, Loader2, Languages } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';
import { useLogout } from '@/hooks/api/useAuth';
import { cn } from '@/lib/utils';
import { type Locale, DEFAULT_LOCALE } from '@/i18n/request';

interface DevToolsBarProps {
  className?: string;
}

export function DevToolsBar({ className }: DevToolsBarProps) {
  const t = useTranslations('common.ariaLabels');
  const tCommon = useTranslations('common');
  const { user, authenticateFakeUser, authenticateFakeSuperadmin } = useAuth();
  const logoutMutation = useLogout();
  const addToast = useToastStore((state) => state.addToast);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<Locale>(DEFAULT_LOCALE);

  // Detect current locale on mount
  useEffect(() => {
    const detectLocale = (): Locale => {
      if (typeof window === 'undefined') {
        return DEFAULT_LOCALE;
      }

      try {
        const cookieLocale = document.cookie
          .split('; ')
          .find(row => row.startsWith('NEXT_LOCALE='))
          ?.split('=')[1];

        if (cookieLocale === 'ru' || cookieLocale === 'en') {
          return cookieLocale;
        }

        const stored = localStorage.getItem('language');
        if (stored === 'ru' || stored === 'en') {
          return stored;
        }

        return DEFAULT_LOCALE;
      } catch {
        return DEFAULT_LOCALE;
      }
    };

    setCurrentLocale(detectLocale());
  }, []);

  const handleFakeAuth = async () => {
    try {
      setIsAuthenticating(true);
      await authenticateFakeUser();
      addToast(tCommon('loginAsTestUser'), 'success');
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : tCommon('loginError'), 'error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleFakeSuperadminAuth = async () => {
    try {
      setIsAuthenticating(true);
      await authenticateFakeSuperadmin();
      addToast(tCommon('loginAsSuperadmin'), 'success');
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : tCommon('loginError'), 'error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      addToast(tCommon('logoutSuccess'), 'success');
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : tCommon('logoutError'), 'error');
    }
  };

  const handleLanguageChange = (newLocale: Locale) => {
    if (newLocale === currentLocale) return;

    // Set cookie
    const isSecure = window.location.protocol === 'https:';
    const secureFlag = isSecure ? '; secure' : '';
    document.cookie = `NEXT_LOCALE=${newLocale}; max-age=${365 * 24 * 60 * 60}; path=/; samesite=lax${secureFlag}`;
    
    // Set localStorage
    localStorage.setItem('language', newLocale);
    
    // Update document language
    document.documentElement.lang = newLocale;
    
    // Reload page to apply new locale
    window.location.reload();
  };

  if (isHidden) {
    return (
      <div className={cn('fixed top-0 left-0 right-0 z-50 bg-base-200/95 backdrop-blur-sm border-b border-base-300', className)}>
        <div className="container mx-auto px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHidden(false)}
            className="h-6 px-2 text-xs"
          >
            Dev Tools
          </Button>
        </div>
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div className={cn('fixed top-0 left-0 right-0 z-50 bg-base-200/95 backdrop-blur-sm border-b border-base-300', className)}>
        <div className="container mx-auto px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(false)}
            className="h-6 px-2 text-xs"
          >
            Dev Tools
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('fixed top-0 left-0 right-0 z-[100] bg-base-200/95 backdrop-blur-sm border-b border-base-300 shadow-sm', className)}>
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-base-content/70">Dev Tools:</span>
            
            {/* Language Switcher */}
            <div className="flex items-center gap-1 border border-base-300 rounded-md overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleLanguageChange('ru')}
                className={cn(
                  "h-7 px-2 text-xs rounded-none border-0",
                  currentLocale === 'ru' 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-base-300"
                )}
              >
                RU
              </Button>
              <div className="w-px h-4 bg-base-300" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleLanguageChange('en')}
                className={cn(
                  "h-7 px-2 text-xs rounded-none border-0",
                  currentLocale === 'en' 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-base-300"
                )}
              >
                EN
              </Button>
            </div>
            
            {!user ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFakeAuth}
                  disabled={isAuthenticating}
                  className="h-7 px-3 text-xs"
                >
                  {isAuthenticating ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <User className="w-3 h-3 mr-1" />
                  )}
                  Тестовый пользователь
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFakeSuperadminAuth}
                  disabled={isAuthenticating}
                  className="h-7 px-3 text-xs"
                >
                  {isAuthenticating ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <Shield className="w-3 h-3 mr-1" />
                  )}
                  Суперадмин
                </Button>
              </>
            ) : (
              <>
                <span className="text-xs text-base-content/60">
                  {user.displayName || user.username} {user.globalRole === 'superadmin' && '(суперадмин)'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  className="h-7 px-3 text-xs"
                >
                  {logoutMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <LogOut className="w-3 h-3 mr-1" />
                  )}
                  Выход
                </Button>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHidden(true)}
            className="h-6 w-6 p-0"
            aria-label={t('closeDevTools')}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

