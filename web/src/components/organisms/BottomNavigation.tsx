'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { User, Bell, Info, Sparkles, FolderKanban, TrendingUp, Star, LifeBuoy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/api/useNotifications';
import { useUserMeritsBalance } from '@/hooks/useUserMeritsBalance';
import { useMarathonOfGoodQuota } from '@/hooks/useMarathonOfGoodQuota';
import { useUserQuota } from '@/hooks/api/useQuota';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { CreateMenu } from '@/components/molecules/FabMenu/CreateMenu';
import { routes } from '@/lib/constants/routes';
import { trackMeriterUiEvent, type NavPrimaryItem } from '@/lib/telemetry/meriter-ui-telemetry';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/shadcn/dialog';

export interface NavTab {
    name: string;
    icon: React.ElementType;
    path: string;
    isActive: (path: string) => boolean;
    badge?: number;
}

export interface BottomNavigationProps {
    customTabs?: NavTab[];
}

const LONG_PRESS_MS = 500;

function primaryFromBottomPath(path: string): NavPrimaryItem | null {
    if (path.startsWith('/meriter/future-visions')) return 'future_visions';
    if (path.startsWith('/meriter/projects')) return 'projects';
    if (path.startsWith('/meriter/notifications')) return 'notifications';
    if (path === '/meriter/profile' || path.startsWith('/meriter/profile')) return 'profile';
    if (path.startsWith('/meriter/communities/')) return 'marathon';
    return null;
}

export const BottomNavigation = ({ customTabs }: BottomNavigationProps) => {
    const pathname = usePathname();
    const router = useRouter();
    const t = useTranslations('common');
    const tCommunities = useTranslations('communities');
    const { logout } = useAuth();
    const { data } = useUnreadCount();
    const unreadCount = data?.count ?? 0;
    const [showQuotaHint, setShowQuotaHint] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressFiredRef = useRef(false);

    // Calculate total merits balance (permanent and daily)
    const { totalWalletBalance, totalDailyQuota, wallets } = useUserMeritsBalance();

    // Detect community context from pathname
    const communityContextId = useMemo(() => {
        if (!pathname) return null;
        // Match patterns: /meriter/communities/[id] or /meriter/communities/[id]/...
        const match = pathname.match(/\/meriter\/communities\/([^\/]+)/);
        return match ? match[1] : null;
    }, [pathname]);

    // Check if we're on a page where CreateMenu should be hidden
    const shouldShowCreateMenu = useMemo(() => {
        if (!pathname || !communityContextId) return false;
        
        // Hide on members page, settings page, and create pages
        const isMembersPage = pathname.includes('/members');
        const isSettingsPage = pathname.includes('/settings');
        const isCreatePage = pathname.includes('/create');
        const isEventsPage = pathname.includes('/events');
        
        return !isMembersPage && !isSettingsPage && !isCreatePage && !isEventsPage;
    }, [pathname, communityContextId]);

    // Get marathon-of-good quota for global context
    const { remaining: marathonQuotaRemaining, max: marathonQuotaMax, isLoading: marathonQuotaLoading } = useMarathonOfGoodQuota();

    // Get community-specific quota when in community context
    const { data: communityQuota, isLoading: communityQuotaLoading } = useUserQuota(communityContextId || undefined);

    // Determine which quota to use and loading state
    const isInCommunityContext = !!communityContextId;
    const quotaRemaining = isInCommunityContext
        ? (communityQuota?.remainingToday ?? 0)
        : marathonQuotaRemaining;
    const quotaMax = isInCommunityContext
        ? (communityQuota?.dailyQuota ?? 0)
        : marathonQuotaMax;
    const quotaLoading = isInCommunityContext
        ? communityQuotaLoading
        : marathonQuotaLoading;

    // Track previous context mode to detect changes
    const prevContextModeRef = useRef<'global' | 'community' | null>(null);
    const [flashTrigger, setFlashTrigger] = useState(0);

    // Detect context mode changes and trigger flash
    useEffect(() => {
        const currentMode: 'global' | 'community' = isInCommunityContext ? 'community' : 'global';
        const prevMode = prevContextModeRef.current;

        // Only trigger flash if mode actually changed (not on initial load)
        if (prevMode !== null && prevMode !== currentMode) {
            setFlashTrigger(prev => prev + 1);
        }

        prevContextModeRef.current = currentMode;
    }, [isInCommunityContext]);

    // Get marathon-of-good community ID for navigation
    const { communities: userCommunities } = useUserCommunities();
    const marathonOfGoodCommunityId = useMemo(() => {
        const marathonCommunity = userCommunities.find((c: any) => c?.typeTag === 'marathon-of-good');
        return marathonCommunity?.id || null;
    }, [userCommunities]);

    // Get current community or first community ID for currency icon
    const communityIdForIcon = useMemo(() => {
        if (communityContextId) return communityContextId;
        const walletWithCommunity = wallets.find((w: any) => w?.communityId);
        return walletWithCommunity?.communityId;
    }, [communityContextId, wallets]);

    // Fetch community to get currency icon
    const { data: communityForIcon } = useCommunity(communityIdForIcon || '');
    const currencyIconUrl = communityForIcon?.settings?.iconUrl;

    // Determine if we should show golden variant (marathon-of-good)
    // If not in community context, we show marathon quota by default -> golden
    // If in community context, we check if it is marathon-of-good -> golden
    const isMarathonQuota = !isInCommunityContext || communityForIcon?.typeTag === 'marathon-of-good';

    const supportCommunityId = useMemo(() => {
        const support = userCommunities.find((c: { typeTag?: string }) => c?.typeTag === 'support');
        return support?.id ?? null;
    }, [userCommunities]);

    const defaultTabs: NavTab[] = useMemo(() => [
        {
            name: t('futureVisions', { defaultValue: 'Future Visions' }),
            icon: Sparkles,
            path: '/meriter/future-visions',
            isActive: (path: string) => path.startsWith('/meriter/future-visions'),
        },
        {
            name: t('marathonOfGoodLabel', { defaultValue: 'Exchange' }),
            icon: TrendingUp,
            path: marathonOfGoodCommunityId ? `/meriter/communities/${marathonOfGoodCommunityId}` : '/meriter/profile',
            isActive: (path: string) =>
                !!marathonOfGoodCommunityId && (path === `/meriter/communities/${marathonOfGoodCommunityId}` || path.startsWith(`/meriter/communities/${marathonOfGoodCommunityId}/`)),
        },
        {
            name: t('projects', { defaultValue: 'Projects' }),
            icon: FolderKanban,
            path: '/meriter/projects',
            isActive: (path: string) => path.startsWith('/meriter/projects'),
        },
        {
            name: t('notifications'),
            icon: Bell,
            path: '/meriter/notifications',
            isActive: (path: string) => path.startsWith('/meriter/notifications'),
            badge: unreadCount > 0 ? unreadCount : undefined,
        },
        {
            name: t('myProfile', { defaultValue: 'Profile' }),
            icon: User,
            path: '/meriter/profile',
            isActive: (path: string) => path.startsWith('/meriter/profile'),
        },
    ], [t, unreadCount, marathonOfGoodCommunityId]);

    const tabs = customTabs || defaultTabs;

    const handleProfilePointerDown = useCallback(() => {
        longPressFiredRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
            longPressTimerRef.current = null;
            longPressFiredRef.current = true;
            setShowProfileMenu(true);
        }, LONG_PRESS_MS);
    }, []);

    const handleProfilePointerUp = useCallback(
        (path: string) => {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
            if (!longPressFiredRef.current) {
                trackMeriterUiEvent({
                    name: 'nav_primary_click',
                    payload: { item: 'profile', surface: 'bottom' },
                });
                router.push(path);
            }
        },
        [router]
    );

    const handleProfileMenuAction = useCallback(
        (path: string | null) => {
            setShowProfileMenu(false);
            if (path) router.push(path);
        },
        [router]
    );

    const handleLogout = useCallback(async () => {
        setShowProfileMenu(false);
        await logout();
    }, [logout]);

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-40 w-full border-t border-base-300/70 bg-base-100/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] backdrop-blur-lg lg:hidden"
            style={{ maxWidth: '100vw' }}
        >
            <div className="h-16 flex items-center justify-around px-2 py-1 w-full relative">
                {tabs.map((tab) => {
                    const active = tab.isActive(pathname || '');
                    const Icon = tab.icon;
                    const isProfile = tab.path === '/meriter/profile';

                    return (
                        <button
                            key={tab.name}
                            onClick={() => {
                                if (!isProfile) {
                                    const item = primaryFromBottomPath(tab.path);
                                    if (item) {
                                        trackMeriterUiEvent({
                                            name: 'nav_primary_click',
                                            payload: { item, surface: 'bottom' },
                                        });
                                    }
                                    router.push(tab.path);
                                }
                            }}
                            onPointerDown={isProfile ? handleProfilePointerDown : undefined}
                            onPointerUp={isProfile ? () => handleProfilePointerUp(tab.path) : undefined}
                            onPointerLeave={() => {
                                if (isProfile && longPressTimerRef.current) {
                                    clearTimeout(longPressTimerRef.current);
                                    longPressTimerRef.current = null;
                                }
                            }}
                            onContextMenu={isProfile ? (e) => e.preventDefault() : undefined}
                            className="flex-1 flex flex-col items-center justify-center py-1 bg-transparent border-none relative"
                            type="button"
                        >
                            <div className={`p-1.5 rounded-full ${active ? 'bg-primary/10' : 'bg-transparent'} relative`}>
                                <Icon
                                    size={24}
                                    className={active ? 'text-primary' : 'text-base-content/60'}
                                    strokeWidth={active ? 2.5 : 2}
                                />
                                {tab.badge && tab.badge > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                        {tab.badge > 99 ? '99+' : tab.badge}
                                    </span>
                                )}
                            </div>
                            <span
                                className={`text-xs mt-0.5 font-medium ${active ? 'text-primary' : 'text-base-content/60'}`}
                            >
                                {tab.name}
                            </span>
                        </button>
                    );
                })}

                {/* Create Menu - centered overlay, 50% overlap with nav bar, 50% protruding upward */}
                {/* Nav bar height is 64px (h-16), so bottom = 64 - 16 = 48px */}
                {/* Only show CreateMenu when inside a community and not on excluded pages */}
                {isInCommunityContext && communityContextId && shouldShowCreateMenu && (
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-12 z-[100]">
                        <CreateMenu communityId={communityContextId} />
                    </div>
                )}
            </div>

            {/* Quota Hint Dialog */}
            <Dialog open={showQuotaHint} onOpenChange={setShowQuotaHint}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-left">
                            {t('dailyMerits')}
                        </DialogTitle>
                        <DialogDescription className="text-left text-base-content/80 pt-2 [&]:text-base-content/80">
                            {tCommunities('quotaHelper')}
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>

            {/* Profile long-press menu: About, Support, Favorites, Log out */}
            <Dialog open={showProfileMenu} onOpenChange={setShowProfileMenu}>
                <DialogContent className="sm:max-w-xs p-0 gap-0">
                    <DialogHeader className="px-4 pt-4 pb-2">
                        <DialogTitle className="text-left text-base">{t('myProfile', { defaultValue: 'Profile' })}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col py-2">
                        <button
                            type="button"
                            className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-base-200 transition-colors"
                            onClick={() => handleProfileMenuAction(routes.about)}
                        >
                            <Info className="w-5 h-5 text-base-content/60" />
                            <span className="text-sm font-medium">{t('aboutProject')}</span>
                        </button>
                        {supportCommunityId && (
                            <button
                                type="button"
                                className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-base-200 transition-colors"
                                onClick={() => handleProfileMenuAction(routes.community(supportCommunityId))}
                            >
                                <LifeBuoy className="w-5 h-5 text-base-content/60" />
                                <span className="text-sm font-medium">{t('support')}</span>
                            </button>
                        )}
                        <button
                            type="button"
                            className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-base-200 transition-colors"
                            onClick={() => handleProfileMenuAction(`${routes.profile}/favorites`)}
                        >
                            <Star className="w-5 h-5 text-base-content/60" />
                            <span className="text-sm font-medium">{t('favorites')}</span>
                        </button>
                        <button
                            type="button"
                            className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-base-200 transition-colors text-error"
                            onClick={handleLogout}
                        >
                            <span className="text-sm font-medium">{t('logoutLabel', { defaultValue: 'Log out' })}</span>
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
