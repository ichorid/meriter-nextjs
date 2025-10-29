'use client';

import { use, useEffect, useState } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useRouter } from "next/navigation";
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
import { useWalletBalance, walletKeys } from '@/hooks/api/useWallet';
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
    
    const { data: balance = 0 } = useWalletBalance(chatId);

    const { data: userdata = {} } = useUserProfile(user?.id || '');
    const { data: wallets = [] } = useWallets();

    const queryClient = useQueryClient();

    // Wallet balance updates are handled optimistically in vote mutation hooks
    const updateWalletBalance = () => {
        // No-op - optimistic updates handled in hooks
    };

    const updateAll = async () => {
        // Close the active withdraw slider after successful update
        setActiveWithdrawPost(null);
        // Invalidate queries to refresh data
        await queryClient.invalidateQueries({ queryKey: walletKeys.wallets() });
        if (chatId) {
            await queryClient.invalidateQueries({ queryKey: walletKeys.balance(chatId) });
        }
    };

    const updBalance = async () => {
        // Invalidate balance query to refresh
        if (chatId) {
            await queryClient.invalidateQueries({ queryKey: walletKeys.balance(chatId) });
        }
    };

    const chatNameVerb = String(poll?.communityId ?? "");
    const activeCommentHook = useState<string | null>(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);

    // Remove authentication check - let the existing auth flow handle it
    // The user is already authenticated if they have a JWT token

    // Debug user object
    console.log('🔍 Poll page user object:', { 
        user: user, 
        hasToken: !!user?.id, 
        hasInit: !!user?.id,
        hasUserId: !!user?.id 
    });

    if (!user?.id) {
        console.log('❌ Poll page: No user id, returning null');
        return null;
    }

    const tgAuthorId = user?.id;

    // Handle case when poll is not found
    if (pollError || !poll) {
        return (
            <AdaptiveLayout 
                className="feed"
                communityId={chatId || ''}
                balance={balance}
                updBalance={updBalance}
                wallets={wallets}
                updateWalletBalance={updateWalletBalance}
                updateAll={updateAll}
                myId={user?.id}
                activeCommentHook={activeCommentHook}
                activeSlider={activeSlider}
                setActiveSlider={setActiveSlider}
                activeWithdrawPost={activeWithdrawPost}
                setActiveWithdrawPost={setActiveWithdrawPost}
            >
                <MenuBreadcrumbs
                    chatId={chatId}
                    chatNameVerb={chatNameVerb}
                    chatIcon={comms?.avatarUrl}
                    postText="Poll Not Found"
                />
                
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
            </AdaptiveLayout>
        );
    }

    // Show loading state while poll data is being fetched
    if (!poll) {
        return (
            <AdaptiveLayout 
                className="feed"
                communityId={chatId || ''}
                balance={balance}
                updBalance={updBalance}
                wallets={wallets}
                updateWalletBalance={updateWalletBalance}
                updateAll={updateAll}
                myId={user?.id}
                activeCommentHook={activeCommentHook}
                activeSlider={activeSlider}
                setActiveSlider={setActiveSlider}
                activeWithdrawPost={activeWithdrawPost}
                setActiveWithdrawPost={setActiveWithdrawPost}
            >
                <MenuBreadcrumbs
                    chatId={chatId}
                    chatNameVerb={chatNameVerb}
                    chatIcon={comms?.avatarUrl}
                    postText="Loading Poll..."
                />
                
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="loading loading-spinner loading-lg"></div>
                        <p className="mt-4">Loading poll...</p>
                    </div>
                </div>
            </AdaptiveLayout>
        );
    }

    return (
        <AdaptiveLayout 
            className="feed"
            communityId={chatId || ''}
            balance={balance}
            updBalance={updBalance}
            wallets={wallets}
            updateWalletBalance={updateWalletBalance}
            updateAll={updateAll}
            myId={user?.id}
            activeCommentHook={activeCommentHook}
            activeSlider={activeSlider}
            setActiveSlider={setActiveSlider}
            activeWithdrawPost={activeWithdrawPost}
            setActiveWithdrawPost={setActiveWithdrawPost}
        >
            <MenuBreadcrumbs
                chatId={chatId}
                chatNameVerb={chatNameVerb}
                chatIcon={comms?.avatarUrl}
                postText={poll?.question ? ellipsize(poll.question, 60) : 'Poll'}
            />

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
                    myId={user?.id}
                    onlyPublication={true}
                    highlightTransactionId={undefined}
                    isDetailPage={true}
                    showCommunityAvatar={false}
                />
            </div>
        </AdaptiveLayout>
    );
};

export default PollPage;
