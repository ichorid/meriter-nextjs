'use client';

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Users, User, Bell, Info } from 'lucide-react';
import { useUnreadCount } from '@/hooks/api/useNotifications';
import { useUserMeritsBalance } from '@/hooks/useUserMeritsBalance';
import { useMarathonOfGoodQuota } from '@/hooks/useMarathonOfGoodQuota';
import { useUserQuota } from '@/hooks/api/useQuota';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { WalletChip } from '@/components/molecules/WalletChip';
import { routes } from '@/lib/constants/routes';

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

export const BottomNavigation = ({ customTabs }: BottomNavigationProps) => {
    const pathname = usePathname();
    const router = useRouter();
    const { data: unreadCount = 0 } = useUnreadCount();

    // Calculate total merits balance (permanent and daily)
    const { totalWalletBalance, totalDailyQuota, wallets } = useUserMeritsBalance();

    // Detect community context from pathname
    const communityContextId = useMemo(() => {
        if (!pathname) return null;
        // Match patterns: /meriter/communities/[id] or /meriter/communities/[id]/...
        const match = pathname.match(/\/meriter\/communities\/([^\/]+)/);
        return match ? match[1] : null;
    }, [pathname]);

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
        const marathonCommunity = userCommunities.find((c: unknown) => c?.typeTag === 'marathon-of-good');
        return marathonCommunity?.id || null;
    }, [userCommunities]);

    // Get current community or first community ID for currency icon
    const communityIdForIcon = useMemo(() => {
        if (communityContextId) return communityContextId;
        const walletWithCommunity = wallets.find((w: unknown) => w?.communityId);
        return walletWithCommunity?.communityId;
    }, [communityContextId, wallets]);

    // Fetch community to get currency icon
    const { data: communityForIcon } = useCommunity(communityIdForIcon || '');
    const currencyIconUrl = communityForIcon?.settings?.iconUrl;

    // Determine if we should show golden variant (marathon-of-good)
    // If not in community context, we show marathon quota by default -> golden
    // If in community context, we check if it is marathon-of-good -> golden
    const isMarathonQuota = !isInCommunityContext || communityForIcon?.typeTag === 'marathon-of-good';

    // Handle click on WalletChip to navigate appropriately
    const handleWalletChipClick = () => {
        if (isInCommunityContext && communityContextId) {
            // In community context, navigate to that community
            router.push(`/meriter/communities/${communityContextId}`);
        } else if (marathonOfGoodCommunityId) {
            // Out of community context, navigate to marathon-of-good
            router.push(`/meriter/communities/${marathonOfGoodCommunityId}`);
        } else {
            // Fallback to communities list
            router.push(routes.communities);
        }
    };

    const defaultTabs: NavTab[] = [
        {
            name: 'Communities',
            icon: Users,
            path: '/meriter/communities',
            isActive: (path: string) => path.startsWith('/meriter/communities'),
        },
        {
            name: 'Notifications',
            icon: Bell,
            path: '/meriter/notifications',
            isActive: (path: string) => path.startsWith('/meriter/notifications'),
            badge: unreadCount > 0 ? unreadCount : undefined,
        },
        {
            name: 'Profile',
            icon: User,
            path: '/meriter/profile',
            isActive: (path: string) => path.startsWith('/meriter/profile'),
        },
        {
            name: 'About',
            icon: Info,
            path: routes.about,
            isActive: (path: string) => path === routes.about,
        },
    ];

    const tabs = customTabs || defaultTabs;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-300 pb-[env(safe-area-inset-bottom)] z-40 lg:hidden w-full" style={{ maxWidth: '100vw' }}>
            <div className="h-16 flex items-center justify-around px-2 py-1 w-full relative">
                {tabs.map((tab) => {
                    const active = tab.isActive(pathname || '');
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.name}
                            onClick={() => router.push(tab.path)}
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

                {/* Wallet Chip - centered overlay, 50% overlap with nav bar, 50% protruding upward */}
                {/* Nav bar height is 64px (h-16), chip height is ~32px, so bottom = 64 - 16 = 48px */}
                {!quotaLoading && (
                    <WalletChip
                        balance={totalWalletBalance}
                        quota={totalDailyQuota}
                        currencyIconUrl={currencyIconUrl}
                        onClick={handleWalletChipClick}
                        className="bottom-12"
                        quotaRemaining={quotaRemaining}
                        quotaMax={quotaMax}
                        showRing={true}
                        flashTrigger={flashTrigger}
                        variant={isMarathonQuota ? 'golden' : 'default'}
                    />
                )}
            </div>
        </div>
    );
};
