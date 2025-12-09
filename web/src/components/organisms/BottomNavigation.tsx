'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Users, User, Bell, Info } from 'lucide-react';
import { useUnreadCount } from '@/hooks/api/useNotifications';
import { useUserMeritsBalance } from '@/hooks/useUserMeritsBalance';
import { useMarathonOfGoodQuota } from '@/hooks/useMarathonOfGoodQuota';
import { useCommunity } from '@/hooks/api/useCommunities';
import { WalletChip } from '@/components/molecules/WalletChip';
import { routes } from '@/lib/constants/routes';

export const BottomNavigation = () => {
    const pathname = usePathname();
    const router = useRouter();
    const { data: unreadCount = 0 } = useUnreadCount();
    
    // Calculate total merits balance (permanent and daily)
    const { totalWalletBalance, totalDailyQuota, wallets } = useUserMeritsBalance();
    
    // Get marathon-of-good quota for the ring
    const { remaining: quotaRemaining, max: quotaMax, isLoading: quotaLoading } = useMarathonOfGoodQuota();
    
    // Get first community ID for currency icon
    const firstCommunityId = useMemo(() => {
        const walletWithCommunity = wallets.find((w: any) => w?.communityId);
        return walletWithCommunity?.communityId;
    }, [wallets]);
    
    // Fetch first community to get currency icon
    const { data: firstCommunity } = useCommunity(firstCommunityId || '');
    const currencyIconUrl = firstCommunity?.settings?.iconUrl;

    const tabs = [
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
                        onClick={() => router.push(routes.communities)}
                        className="bottom-12"
                        quotaRemaining={quotaRemaining}
                        quotaMax={quotaMax}
                        showRing={true}
                    />
                )}
            </div>
        </div>
    );
};
