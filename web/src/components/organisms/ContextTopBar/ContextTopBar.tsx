'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCommunity, useWallets } from '@/hooks/api';
import { useUserQuota } from '@/hooks/api/useQuota';
import { useTranslations } from 'next-intl';
import { isFakeDataMode } from '@/config';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { cn } from '@/lib/utils';
import { Clock, TrendingUp, Loader2, Search, X, ArrowLeft, Coins } from 'lucide-react';
import { useProfileTabState } from '@/hooks/useProfileTabState';
import type { TabSortState } from '@/hooks/useProfileTabState';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { SortToggle } from '@/components/ui/SortToggle';
import { CreateMenu } from '@/components/molecules/FabMenu/CreateMenu';
import { InviteMenu } from '@/components/molecules/FabMenu/InviteMenu';

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
  rightAction?: React.ReactNode;
  className?: string;
  asStickyHeader?: boolean;
}> = ({
  title,
  onBack,
  showBack = true,
  rightAction,
  className = '',
  asStickyHeader = false
}) => {
    const router = useRouter();
    const tCommon = useTranslations('common');

    const handleBack = () => {
      if (onBack) {
        onBack();
      } else {
        router.back();
      }
    };

    const headerContent = (
      <div className={`${asStickyHeader ? "bg-base-100/95 backdrop-blur-md border-b border-base-content/10" : "sticky top-0 z-30 bg-base-100/95 backdrop-blur-md border-b border-base-content/10 w-full"} ${className}`}>
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center flex-1 min-w-0">
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
export const CommunityTopBar: React.FC<{ communityId: string; asStickyHeader?: boolean; activeTab?: string; futureVisionCommunityId?: string | null }> = ({ communityId, asStickyHeader = false, activeTab = 'publications', futureVisionCommunityId = null }) => {
  const { data: community, isLoading: communityLoading } = useCommunity(communityId);
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('pages.communities');
  const tCommon = useTranslations('common');
  
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
  const [showSearchModal, setShowSearchModal] = React.useState(false);

  // Fake data generation state
  const fakeDataMode = isFakeDataMode();
  const [generatingUserPosts, setGeneratingUserPosts] = React.useState(false);
  const [generatingBeneficiaryPosts, setGeneratingBeneficiaryPosts] = React.useState(false);
  const [addingMerits, setAddingMerits] = React.useState(false);
  const [fakeDataMessage, setFakeDataMessage] = React.useState('');

  // Get sortBy from URL params
  const sortBy = searchParams?.get('sort') === 'recent' ? 'recent' : 'voted';
  const selectedTag = searchParams?.get('tag');
  const searchQuery = searchParams?.get('q') || '';
  const [localSearchQuery, setLocalSearchQuery] = React.useState(searchQuery);

  // Handle sort change
  const handleSortChange = (sort: 'recent' | 'voted') => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('sort', sort);
    router.push(`?${params.toString()}`);
  };

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

  // Handle search query change
  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value.trim()) {
      params.set('q', value.trim());
    } else {
      params.delete('q');
    }
    router.push(`?${params.toString()}`);
  };

  // Handle search clear
  const handleSearchClear = () => {
    setLocalSearchQuery('');
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('q');
    router.push(`?${params.toString()}`);
  };

  // Sync local search query with URL params
  React.useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Handle fake data generation
  const generateFakeDataMutation = trpc.publications.generateFakeData.useMutation();
  const addMeritsMutation = trpc.wallets.addMerits.useMutation();
  const utils = trpc.useUtils();

  const handleGenerateUserPosts = async () => {
    setGeneratingUserPosts(true);
    setFakeDataMessage('');

    try {
      const result = await generateFakeDataMutation.mutateAsync({
        type: 'user',
        communityId,
      });
      setFakeDataMessage(`Created ${result.count} user post(s)`);
      setTimeout(() => setFakeDataMessage(''), 3000);
      router.refresh();
    } catch (error) {
      console.error('Generate user posts error:', error);
      setFakeDataMessage('Failed to generate user posts');
      setTimeout(() => setFakeDataMessage(''), 3000);
    } finally {
      setGeneratingUserPosts(false);
    }
  };

  const handleGenerateBeneficiaryPosts = async () => {
    setGeneratingBeneficiaryPosts(true);
    setFakeDataMessage('');

    try {
      const result = await generateFakeDataMutation.mutateAsync({
        type: 'beneficiary',
        communityId,
      });
      setFakeDataMessage(`Created ${result.count} post(s) with beneficiary`);
      setTimeout(() => setFakeDataMessage(''), 3000);
      router.refresh();
    } catch (error) {
      console.error('Generate beneficiary posts error:', error);
      setFakeDataMessage('Failed to generate posts with beneficiary');
      setTimeout(() => setFakeDataMessage(''), 3000);
    } finally {
      setGeneratingBeneficiaryPosts(false);
    }
  };

  const handleAddMerits = async () => {
    setAddingMerits(true);
    setFakeDataMessage('');

    try {
      const result = await addMeritsMutation.mutateAsync({
        communityId,
        amount: 100,
      });
      setFakeDataMessage(result.message);
      setTimeout(() => setFakeDataMessage(''), 3000);
      // Invalidate wallets to refresh the balance
      utils.wallets.getAll.invalidate();
      utils.wallets.getBalance.invalidate({ communityId });
    } catch (error) {
      console.error('Add merits error:', error);
      setFakeDataMessage('Failed to add merits');
      setTimeout(() => setFakeDataMessage(''), 3000);
    } finally {
      setAddingMerits(false);
    }
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
      rightAction={
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Fake Data Buttons - dev only - LEFT SIDE */}
          {fakeDataMode && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateUserPosts}
                disabled={generatingUserPosts || generatingBeneficiaryPosts || addingMerits}
                className="rounded-xl active:scale-[0.98] px-2"
                title="Generate user post"
              >
                {generatingUserPosts ? <Loader2 className="animate-spin" size={16} /> : <span>+</span>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateBeneficiaryPosts}
                disabled={generatingUserPosts || generatingBeneficiaryPosts || addingMerits}
                className="rounded-xl active:scale-[0.98] px-2"
                title="Generate post with beneficiary"
              >
                {generatingBeneficiaryPosts ? <Loader2 className="animate-spin" size={16} /> : <span>++</span>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddMerits}
                disabled={generatingUserPosts || generatingBeneficiaryPosts || addingMerits}
                className="rounded-xl active:scale-[0.98] px-2"
                title="Add 100 wallet merits"
              >
                {addingMerits ? <Loader2 className="animate-spin" size={16} /> : <Coins size={16} className="text-base-content/70" />}
              </Button>
              {fakeDataMessage && (
                <span className={`text-xs ${fakeDataMessage.includes('Failed') ? 'text-error' : 'text-success'}`}>
                  {fakeDataMessage}
                </span>
              )}
            </>
          )}

          {/* Search Button - only show on publications tab */}
          {activeTab === 'publications' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearchModal(true)}
              className="rounded-xl active:scale-[0.98] px-2"
            >
              <Search size={18} className="text-base-content/70" />
            </Button>
          )}

          {/* Sort Toggle - only show on publications tab */}
          {activeTab === 'publications' && (
            <div className="flex gap-0.5 bg-base-200/50 p-0.5 rounded-lg">
              <SortToggle
                value={sortBy}
                onChange={handleSortChange}
                compact={true}
              />
            </div>
          )}

          {/* Create Menu - for publications and vision tabs - RIGHTMOST */}
          {activeTab === 'publications' && (
            <CreateMenu communityId={communityId} />
          )}
          {activeTab === 'vision' && futureVisionCommunityId && (
            <CreateMenu communityId={futureVisionCommunityId} />
          )}

          {/* Invite Menu - for members tab - RIGHTMOST */}
          {activeTab === 'members' && (
            <InviteMenu communityId={communityId} />
          )}
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

      {/* Search Modal */}
      {showSearchModal && (
        <BottomActionSheet
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          title={t('searchPlaceholder')}
        >
          <div className="relative w-full">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={localSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={cn('h-11 rounded-xl pl-10', localSearchQuery && 'pr-10')}
              autoFocus
            />
            {localSearchQuery && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </BottomActionSheet>
      )}
    </>
  );
};
