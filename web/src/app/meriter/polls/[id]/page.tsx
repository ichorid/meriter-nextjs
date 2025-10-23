'use client';

import { use, useEffect, useState } from "react";
import { swr } from '@lib/swr';
import Page from '@shared/components/page';
import { useRouter } from "next/navigation";
import { HeaderAvatarBalance } from '@shared/components/header-avatar-balance';
import { MenuBreadcrumbs } from '@shared/components/menu-breadcrumbs';
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from '@lib/telegram';
import { Publication } from "@features/feed";
import { useTranslation } from 'react-i18next';
import { ellipsize } from "@shared/lib/text";

const PollPage = ({ params }: { params: Promise<{ id: string }> }) => {
    const router = useRouter();
    const { t } = useTranslation('pages');
    const resolvedParams = use(params);
    const pollId = resolvedParams.id;

    const [user] = swr("/api/rest/getme", { init: true });

    const [pollData, pollError] = swr(
        () => user?.token ? `/api/rest/poll/get?pollId=${pollId}` : null,
        {}
    );

    const poll = pollData?.poll;
    const chatId = poll?.content?.communityId;

    const [chat] = swr(
        () => user?.token && chatId ? `/api/rest/getchat?chatId=${chatId}` : null,
        {},
        { key: "chat" }
    );

    const [comms] = swr(
        () => user?.token && chatId ? `/api/rest/communityinfo?chatId=${chatId}` : null,
        {},
        { key: "comms" }
    );

    const [balance, updBalance] = swr(
        () => user?.token && chatId ? `/api/rest/wallet?tgChatId=${chatId}` : null,
        0,
        { key: "balance" }
    );

    const [userdata] = swr(
        () => user?.tgUserId ? `/api/rest/users/telegram/${user.tgUserId}/profile` : null,
        0,
        { key: "userdata" }
    );

    const [wallets, updateWallets] = swr(
        () => user?.token ? "/api/rest/wallet" : null,
        [],
        { key: "wallets" }
    );

    const updateWalletBalance = (currencyOfCommunityTgChatId: string, amountChange: number) => {
        // Optimistically update wallet balance without reloading
        if (!Array.isArray(wallets)) return;
        
        const updatedWallets = wallets.map((wallet) => {
            if (wallet.meta?.currencyOfCommunityTgChatId === currencyOfCommunityTgChatId) {
                return {
                    ...wallet,
                    value: (wallet.value || 0) + amountChange,
                };
            }
            return wallet;
        });
        updateWallets(updatedWallets, false); // Update without revalidation
    };

    const updateAll = async () => {
        // Close the active withdraw slider after successful update
        setActiveWithdrawPost(null);
    };

    const chatNameVerb = String(chat?.title ?? "");
    const activeCommentHook = useState(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);

    // Remove authentication check - let the existing auth flow handle it
    // The user is already authenticated if they have a JWT token

    // Debug user object
    console.log('🔍 Poll page user object:', { 
        user: user, 
        hasToken: !!user?.token, 
        hasInit: !!user?.init,
        hasTgUserId: !!user?.tgUserId 
    });

    if (!user?.token) {
        console.log('❌ Poll page: No user token, returning null');
        return null;
    }

    const tgAuthorId = user?.tgUserId;

    // Handle case when poll is not found
    if (pollError || (pollData && pollData.error)) {
        return (
            <Page className="feed">
                <HeaderAvatarBalance
                    balance1={{ icon: chat?.icon, amount: balance }}
                    balance2={undefined}
                    avatarUrl={telegramGetAvatarLink(tgAuthorId)}
                    onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId)}
                    onClick={() => {
                        router.push("/meriter/home");
                    }}
                    userName={user?.name || 'User'}
                >
                    <MenuBreadcrumbs
                        chatId={chatId}
                        chatNameVerb={chatNameVerb}
                        chatIcon={comms?.icon}
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
                    balance1={{ icon: chat?.icon, amount: balance }}
                    balance2={undefined}
                    avatarUrl={telegramGetAvatarLink(tgAuthorId)}
                    onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId)}
                    onClick={() => {
                        router.push("/meriter/home");
                    }}
                    userName={user?.name || 'User'}
                >
                    <MenuBreadcrumbs
                        chatId={chatId}
                        chatNameVerb={chatNameVerb}
                        chatIcon={comms?.icon}
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
                balance1={{ icon: chat?.icon, amount: balance }}
                balance2={undefined}
                avatarUrl={telegramGetAvatarLink(tgAuthorId)}
                onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId)}
                onClick={() => {
                    router.push("/meriter/home");
                }}
                userName={user?.name || 'User'}
            >
                <MenuBreadcrumbs
                    chatId={chatId}
                    chatNameVerb={chatNameVerb}
                    chatIcon={comms?.icon}
                    postText={poll?.content?.title ? ellipsize(poll.content.title, 60) : 'Poll'}
                />
            </HeaderAvatarBalance>

            <div className="space-y-4">
                <Publication
                    key={poll._id}
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
                    myId={user?.tgUserId}
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
