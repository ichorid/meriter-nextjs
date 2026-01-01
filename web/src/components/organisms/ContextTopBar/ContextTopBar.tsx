'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCommunity, useWallets } from '@/hooks/api';
import { useUserQuota } from '@/hooks/api/useQuota';
import { useUserRoles } from '@/hooks/api/useProfile';
import { routes } from '@/lib/constants/routes';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Clock, TrendingUp, Loader2, ArrowLeft, ArrowUp, Users, Trash2 } from 'lucide-react';
import { useProfileTabState } from '@/hooks/useProfileTabState';
import type { TabSortState } from '@/hooks/useProfileTabState';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { CreateMenu } from '@/components/molecules/FabMenu/CreateMenu';
import { InviteMenu } from '@/components/molecules/FabMenu/InviteMenu';
import { QuotaDisplay } from '@/components/molecules/QuotaDisplay/QuotaDisplay';

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
export const ProfileTopBar: React.FC<{ asStickyHeader?: boolean }> = ({ asStickyHeader = false }) => {
  const tCommon = useTranslations('common');
  const router = useRouter();


  return (
    <SimpleStickyHeader
      title={tCommon('profile')}
      showBack={false}
      onBack={() => router.push('/meriter/profile')}
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

    const headerContent = (
      <div className={`${asStickyHeader ? "bg-base-100/95 backdrop-blur-md border-b border-base-200 px-4" : "sticky top-0 z-30 bg-base-100/95 backdrop-blur-md border-b border-base-200 w-full px-4"} ${className}`}>
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
                <ArrowLeft size={20} className="text-base-content" />
              </Button>
            )}

            {/* Title */}
            <h1 className="text-lg font-semibold text-base-content truncate px-2">
              {title}
            </h1>
          </div>

          {/* Center Action */}
          {(centerAction || (showScrollToTop && showScrollButton)) && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
              {centerAction || (showScrollToTop && showScrollButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleScrollToTop}
                  className="rounded-xl active:scale-[0.98] px-2"
                  aria-label="Scroll to top"
                  title="Scroll to top"
                >
                  <ArrowUp size={18} className="text-base-content/70" />
                </Button>
              ))}
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
  futureVisionCommunityId?: string | null;
  showQuotaInHeader?: boolean;
  quotaData?: {
    balance?: number;
    quotaRemaining?: number;
    quotaMax?: number;
    currencyIconUrl?: string;
    isMarathonOfGood?: boolean;
    showPermanent?: boolean;
    showDaily?: boolean;
  };
}> = ({
  communityId,
  asStickyHeader = false,
  futureVisionCommunityId = null,
  showQuotaInHeader = false,
  quotaData,
}) => {
    const { data: community, isLoading: communityLoading } = useCommunity(communityId);
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('pages.communities');
    const tCommon = useTranslations('common');
    const { data: userRoles = [] } = useUserRoles(user?.id || '');

    // Check if user is a lead (for deleted button visibility)
    const isLead = user?.globalRole === 'superadmin' ||
      !!userRoles.find((r) => r.communityId === communityId && r.role === 'lead');

    // Safe translation helper to prevent MISSING_MESSAGE errors
    const safeTranslate = (key: string, fallback: string): string => {
      try {
        return tCommon(key);
      } catch {
        return fallback;
      }
    };
    const [showTagDropdown, setShowTagDropdown] = React.useState(false);
    const [showSnack, setShowSnack] = React.useState(false);

    const selectedTag = searchParams?.get('tag');

    // Handle tag filter
    const handleTagClick = (tag: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (selectedTag === tag) {
        params.delete('tag');
      } else {
        params.set('tag', tag);
      }
      router.push(`?${params.toString()}`);
      setShowTagDropdown(false);
    };

    // Handle clear tag filter (show all)
    const handleShowAll = () => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete('tag');
      router.push(`?${params.toString()}`);
      setShowTagDropdown(false);
    };


    const isMobile = !useMediaQuery('(min-width: 768px)');
    // Left nav is hidden below lg breakpoint (1024px), so show back button when nav is hidden
    const isLeftNavHidden = !useMediaQuery('(min-width: 1024px)');

    // Show mobile snack bar with community title when arriving/switching
    React.useEffect(() => {
      if (!isMobile) return;
      setShowSnack(true);
      const timeout = setTimeout(() => setShowSnack(false), 2000);
      return () => clearTimeout(timeout);
    }, [communityId, isMobile]);

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
            <Loader2 className="w-4 h-4 animate-spin text-base-content/70" />
          }
        />
      );
    }

    if (!community) {
      return null;
    }

    const hashtags = community.hashtags || [];

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
            {/* Quota Display in Header */}
            {showQuotaInHeader && quotaData && (
              <QuotaDisplay
                balance={quotaData.balance}
                quotaRemaining={quotaData.quotaRemaining}
                quotaMax={quotaData.quotaMax}
                currencyIconUrl={quotaData.currencyIconUrl}
                isMarathonOfGood={quotaData.isMarathonOfGood}
                showPermanent={quotaData.showPermanent}
                showDaily={quotaData.showDaily}
                compact={true}
                className="mr-2"
              />
            )}
            {/* Members Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(routes.communityMembers(communityId))}
              className="rounded-xl active:scale-[0.98] px-2"
              aria-label={t('members.title') || 'Members'}
              title={t('members.title') || 'Members'}
            >
              <Users size={18} className="text-base-content/70" />
            </Button>

            {/* Deleted Button - only for leads/superadmins */}
            {isLead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(routes.communityDeleted(communityId))}
                className="rounded-xl active:scale-[0.98] px-2"
                aria-label={t('deleted') || 'Deleted'}
                title={t('deleted') || 'Deleted'}
              >
                <Trash2 size={18} className="text-base-content/70" />
              </Button>
            )}

            {/* Create Menu - RIGHTMOST */}
            <div className="ml-2">
              <CreateMenu communityId={communityId} />
            </div>
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
