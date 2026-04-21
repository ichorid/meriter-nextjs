'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCommunity } from '@/hooks/api';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { routes } from '@/lib/constants/routes';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';
import { Clock, TrendingUp, Loader2, ArrowLeft, ArrowUp } from 'lucide-react';
import { useProfileTabState } from '@/hooks/useProfileTabState';
import type { TabSortState } from '@/hooks/useProfileTabState';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { QuotaDisplay } from '@/components/molecules/QuotaDisplay/QuotaDisplay';
import { EarnMeritsBirzhaButton } from '@/components/molecules/EarnMeritsBirzhaButton/EarnMeritsBirzhaButton';
import { useMeriterStitchChrome } from '@/contexts/MeriterChromeContext';

export interface ContextTopBarProps {
  className?: string;
}

export const ContextTopBar: React.FC<ContextTopBarProps> = () => {
  const pathname = usePathname();

  // Don't show on login page
  if (pathname?.includes('/login')) {
    return null;
  }

  // Determine which content to show based on route
  const isProfileMainPage = pathname === '/meriter/profile';
  const isProfileSubPage = pathname?.startsWith('/meriter/profile/');
  const isSettingsPage = pathname === '/meriter/settings';
  const isCommunityPage = pathname?.match(/\/meriter\/communities\/([^\/]+)$/);
  const isPostDetailPage = pathname?.match(/\/meriter\/communities\/([^\/]+)\/posts\/(.+)/);

  if (isPostDetailPage) {
    return null; // PostDetailTopBar was empty
  }

  if (isCommunityPage) {
    // Community pages use stickyHeader in AdaptiveLayout instead
    return null;
  }

  // Only show ProfileTopBar on sub-pages (publications, comments, polls), not on main profile page
  if (isProfileSubPage) {
    return <ProfileTopBar />;
  }

  if (isProfileMainPage) {
    return null; // Main profile page doesn't need top bar
  }

  if (isSettingsPage) {
    return null; // SettingsTopBar was empty
  }

  // Default top bar - empty, no header
  return null;
};

// Profile Top Bar with Tabs
export const ProfileTopBar: React.FC<{
  asStickyHeader?: boolean;
  title?: React.ReactNode;
  showBack?: boolean;
  /** Explicit back target; otherwise `/meriter/users/:id` sub-pages return to that user profile. */
  backHref?: string;
}> = ({ asStickyHeader = false, title, showBack = true, backHref }) => {
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();

  const displayTitle = title ?? tCommon('profile');

  const resolvedBackHref = React.useMemo(() => {
    if (backHref) return backHref;
    const m = pathname?.match(/^\/meriter\/users\/([^/]+)\//);
    if (m) return routes.userProfile(m[1]);
    return '/meriter/profile';
  }, [pathname, backHref]);

  return (
    <SimpleStickyHeader
      title={displayTitle}
      showBack={showBack}
      onBack={() => router.push(resolvedBackHref)}
      asStickyHeader={asStickyHeader}
    />
  );
};

// Simple Sticky Header for generic pages
export const SimpleStickyHeader: React.FC<{
  title: React.ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  leftAction?: React.ReactNode;
  centerAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  className?: string;
  asStickyHeader?: boolean;
  showScrollToTop?: boolean;
}> = ({
  title,
  onBack,
  showBack = true,
  leftAction,
  centerAction,
  rightAction,
  className = '',
  asStickyHeader = false,
  showScrollToTop = false
}) => {
    const sc = useMeriterStitchChrome();
    const router = useRouter();
    const tCommon = useTranslations('common');
    const [showScrollButton, setShowScrollButton] = React.useState(false);

    const handleBack = () => {
      if (onBack) {
        onBack();
      } else {
        router.back();
      }
    };

    // Handle scroll to top
    const handleScrollToTop = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // The main scroll container is .mainWrap
      const mainWrap = document.querySelector('.mainWrap') as HTMLElement;
      if (mainWrap) {
        mainWrap.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Fallback to window/document scroll
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
        document.body.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    // Scroll detection for scroll-to-top button
    React.useEffect(() => {
      if (!showScrollToTop) return;

      const checkScroll = () => {
        // The main scroll container is .mainWrap (has overflow: auto)
        const mainWrap = document.querySelector('.mainWrap') as HTMLElement;

        let scrollTop = 0;
        if (mainWrap) {
          scrollTop = mainWrap.scrollTop;
        } else {
          // Fallback to window/document scroll if mainWrap not found
          scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        }

        const windowHeight = window.innerHeight;

        // Show button if scrolled more than half a screen
        setShowScrollButton(scrollTop > windowHeight / 2);
      };

      // Check on mount with a small delay to ensure DOM is ready
      const timeoutId = setTimeout(checkScroll, 100);

      // Listen to scroll events on the main scroll container
      const mainWrap = document.querySelector('.mainWrap');

      if (mainWrap) {
        mainWrap.addEventListener('scroll', checkScroll, { passive: true });
      } else {
        // Fallback to window scroll if mainWrap not found
        window.addEventListener('scroll', checkScroll, { passive: true });
      }

      // Also listen to resize in case window height changes
      window.addEventListener('resize', checkScroll, { passive: true });

      return () => {
        clearTimeout(timeoutId);
        if (mainWrap) {
          mainWrap.removeEventListener('scroll', checkScroll);
        } else {
          window.removeEventListener('scroll', checkScroll);
        }
        window.removeEventListener('resize', checkScroll);
      };
    }, [showScrollToTop]);

    const shellClass = sc
      ? 'bg-stitch-canvas/95 backdrop-blur-md border-b border-stitch-border shadow-none'
      : 'bg-base-100/80 backdrop-blur-md border-b border-base-300/70 shadow-sm';

    const headerContent = (
      <div
        className={`${asStickyHeader ? `${shellClass} px-4` : `sticky top-0 z-30 w-full ${shellClass} px-4`} ${className}`}
      >
        <div className="flex items-center justify-between h-14 relative">
          <div className="flex items-center flex-1 min-w-0">
            {/* Left Actions */}
            {leftAction && (
              <div className="flex items-center flex-shrink-0 mr-2">
                {leftAction}
              </div>
            )}

            {/* Back Button */}
            {showBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                aria-label={tCommon('goBack')}
                className="rounded-xl active:scale-[0.98] px-2"
              >
                <ArrowLeft size={20} className={sc ? 'text-stitch-text' : 'text-base-content'} />
              </Button>
            )}

            {/* Title */}
            <h1
              className={cn(
                'truncate px-2 text-lg font-semibold',
                sc ? 'text-stitch-text' : 'text-base-content',
              )}
            >
              {title}
            </h1>
          </div>

          {/* Center Action */}
          {centerAction && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
              {centerAction}
            </div>
          )}

          {/* Right Actions */}
          {rightAction && (
            <div className="flex items-center flex-shrink-0">
              {rightAction}
            </div>
          )}
        </div>
      </div>
    );

    return (
      <>
        {asStickyHeader ? headerContent : (
          <div className="flex-shrink-0">
            {headerContent}
          </div>
        )}
      </>
    );
  };

// Community Top Bar
export const CommunityTopBar: React.FC<{
  communityId: string;
  asStickyHeader?: boolean;
}> = ({
  communityId,
  asStickyHeader = false,
}) => {
    const { user } = useAuth();
    const { data: globalBalance = 0 } = useWalletBalance(GLOBAL_COMMUNITY_ID);
    const { data: community, isLoading: communityLoading } = useCommunity(communityId);
    const router = useRouter();

    // Left nav is hidden below lg breakpoint (1024px), so show back button when nav is hidden
    const isLeftNavHidden = !useMediaQuery('(min-width: 1024px)');

    // Show loading state instead of returning null
    if (communityLoading) {
      const handleBack = () => {
        router.push('/meriter/communities');
      };

      return (
        <SimpleStickyHeader
          title=""
          showBack={isLeftNavHidden}
          onBack={handleBack}
          asStickyHeader={asStickyHeader}
          rightAction={
            <div className="flex items-center gap-2 flex-shrink-0">
              {user ? (
                <>
                  <QuotaDisplay
                    balance={globalBalance}
                    showPermanent={true}
                    showDaily={false}
                    compact={true}
                    className="mr-2 -ml-[15px] mt-[5px]"
                  />
                  <EarnMeritsBirzhaButton />
                </>
              ) : null}
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-base-content/70" />
            </div>
          }
        />
      );
    }

    if (!community) {
      return null;
    }

    const handleBack = () => {
      router.push('/meriter/communities');
    };

    const headerContent = (
      <SimpleStickyHeader
        title={community.name}
        showBack={isLeftNavHidden}
        onBack={handleBack}
        asStickyHeader={asStickyHeader}
        showScrollToTop={true}
        rightAction={
          <div className="flex items-center gap-2 flex-shrink-0">
            {user ? (
              <>
                <QuotaDisplay
                  balance={globalBalance}
                  showPermanent={true}
                  showDaily={false}
                  compact={true}
                  className="mr-2 -ml-[15px] mt-[5px]"
                />
                <EarnMeritsBirzhaButton />
              </>
            ) : null}
          </div>
        }
      />
    );

    return (
      <>
        {asStickyHeader ? headerContent : (
          <div className="flex-shrink-0">
            {headerContent}
          </div>
        )}
      </>
    );
  };
