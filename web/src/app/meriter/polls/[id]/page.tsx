'use client';

import { use, useEffect, useState } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import Page from '@shared/components/page';
import { useRouter } from "next/navigation";
import { HeaderAvatarBalance } from '@shared/components/header-avatar-balance';
import { MenuBreadcrumbs } from '@shared/components/menu-breadcrumbs';
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from '@lib/telegram';
import { Publication } from "@features/feed";
import { useTranslations } from 'next-intl';
import { ellipsize } from "@shared/lib/text";
import { useAuth } from '@/contexts/AuthContext';
import { useCommunity, usePolls, usePoll, useUserProfile, useWallets } from '@/hooks/api';
import { usersApiV1, pollsApiV1 } from '@/lib/api/v1';

const PollPage = ({ params }: { params: Promise<{ id: string }> }) => {
    const router = useRouter();
    const t = useTranslations('pages');
    const resolvedParams = use(params);
    const pollId = resolvedParams.id;

    // Use v1 API hooks
    const { user, isAuthenticated } = useAuth();
    const { data: poll, error: pollError } = usePoll(pollId);
    const chatId = poll?.communityId;
    
    const { data: comms } = useCommunity(chatId || '');
    
    const { data: balance = 0 } = useQuery({
        queryKey: ['wallet-balance', user?.telegramId, chatId],
        queryFn: async () => {
            if (!user?.telegramId || !chatId) return 0;
            const wallets = await usersApiV1.getUserWallets(user.telegramId);
            const wallet = wallets.find((w: any) => w.communityId === chatId);
            return wallet?.balance || 0;
        },
        enabled: !!user?.telegramId && !!chatId,
    });

    const { data: userdata = {} } = useUserProfile(user?.telegramId || '');
    const { data: wallets = [] } = useWallets();

    const queryClient = useQueryClient();

    const updateWalletBalance = (currencyOfCommunityTgChatId: string, amountChange: number) => {
        // Optimistically update wallet balance using React Query's cache
        queryClient.setQueryData(['wallets'], (oldWallets: any) => {
            if (!Array.isArray(oldWallets)) return oldWallets;
            
            return oldWallets.map((wallet) => {
                if (wallet.meta?.currencyOfCommunityTgChatId === currencyOfCommunityTgChatId) {
                    return {
                        ...wallet,
                        value: (wallet.value || 0) + amountChange,
                    };
                }
                return wallet;
            });
        });
    };

    const updateAll = async () => {
        // Close the active withdraw slider after successful update
        setActiveWithdrawPost(null);
        // Invalidate queries to refresh data
        await queryClient.invalidateQueries({ queryKey: ['wallets'] });
        await queryClient.invalidateQueries({ queryKey: ['wallet', chatId] });
    };

    const updBalance = () => {
        // Invalidate balance query to refresh
        queryClient.invalidateQueries({ queryKey: ['wallet', chatId] });
    };

    const chatNameVerb = String(poll?.communityId ?? "");
    const activeCommentHook = useState(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);

    // Remove authentication check - let the existing auth flow handle it
    // The user is already authenticated if they have a JWT token

    // Debug user object
    console.log('🔍 Poll page user object:', { 
        user: user, 
        hasToken: !!user?.telegramId, 
        hasInit: !!user?.telegramId,
        hasTgUserId: !!user?.telegramId 
    });

    if (!user?.telegramId) {
        console.log('❌ Poll page: No user telegramId, returning null');
        return null;
    }

    const tgAuthorId = user?.telegramId;

    // Handle case when poll is not found
    if (pollError || !poll) {
        return (
            <Page className="feed">
                <HeaderAvatarBalance
                    balance1={{ icon: undefined, amount: balance }}
                    balance2={undefined}
                    avatarUrl={telegramGetAvatarLink(tgAuthorId)}
                    onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId)}
                    onClick={() => {
                        router.push("/meriter/home");
                    }}
                    userName={user?.displayName || 'User'}
                >
                    <MenuBreadcrumbs
                        chatId={chatId}
                        chatNameVerb={chatNameVerb}
                        chatIcon={comms?.avatarUrl}
                        postText="Poll Not Found"
                    />
                </HeaderAvatarBalance>

                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-4">Poll Not Found</h2>
                        <p className="text-gray-600 mb-6">The poll you're looking for doesn't exist or has been removed.</p>
                        <button 
                            onClick={() => router.push("/meriter/home")}
                            className="btn btn-primary"
                        >
                            Go to Home
                        </button>
                    </div>
                </div>
            </Page>
        );
    }

    // Show loading state while poll data is being fetched
    if (!poll) {
        return (
            <Page className="feed">
                <HeaderAvatarBalance
                    balance1={{ icon: undefined, amount: balance }}
                    balance2={undefined}
                    avatarUrl={telegramGetAvatarLink(tgAuthorId)}
                    onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId)}
                    onClick={() => {
                        router.push("/meriter/home");
                    }}
                    userName={user?.displayName || 'User'}
                >
                    <MenuBreadcrumbs
                        chatId={chatId}
                        chatNameVerb={chatNameVerb}
                        chatIcon={comms?.avatarUrl}
                        postText="Loading Poll..."
                    />
                </HeaderAvatarBalance>

                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="loading loading-spinner loading-lg"></div>
                        <p className="mt-4">Loading poll...</p>
                    </div>
                </div>
            </Page>
        );
    }

    return (
        <Page className="feed">
            <HeaderAvatarBalance
                balance1={{ icon: undefined, amount: balance }}
                balance2={undefined}
                avatarUrl={telegramGetAvatarLink(tgAuthorId)}
                onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId)}
                onClick={() => {
                    router.push("/meriter/home");
                }}
                userName={user?.displayName || 'User'}
            >
                <MenuBreadcrumbs
                    chatId={chatId}
                    chatNameVerb={chatNameVerb}
                    chatIcon={comms?.avatarUrl}
                    postText={poll?.title ? ellipsize(poll.title, 60) : 'Poll'}
                />
            </HeaderAvatarBalance>

            <div className="space-y-4">
                <Publication
                    key={poll.id}
                    {...poll}
                    balance={balance}
                    updBalance={updBalance}
                    activeCommentHook={activeCommentHook}
                    activeSlider={activeSlider}
                    setActiveSlider={setActiveSlider}
                    activeWithdrawPost={activeWithdrawPost}
                    setActiveWithdrawPost={setActiveWithdrawPost}
                    wallets={wallets}
                    updateWalletBalance={updateWalletBalance}
                    updateAll={updateAll}
                    dimensionConfig={undefined}
                    myId={user?.telegramId}
                    onlyPublication={true}
                    highlightTransactionId={undefined}
                    isDetailPage={true}
                    showCommunityAvatar={false}
                />
            </div>
        </Page>
    );
};

export default PollPage;
