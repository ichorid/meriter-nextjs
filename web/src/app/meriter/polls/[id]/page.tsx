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

    const [pollData] = swr(
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
            if (wallet.currencyOfCommunityTgChatId === currencyOfCommunityTgChatId) {
                return {
                    ...wallet,
                    amount: wallet.amount + amountChange,
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

    useEffect(() => {
        if (!user?.tgUserId && !user.init) {
            router.push("/meriter/login?returnTo=" + encodeURIComponent(window.location.pathname));
        }
    }, [user, user?.init, router]);

    if (!user.token) return null;

    const tgAuthorId = user?.tgUserId;

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
                {poll && (
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
                )}
            </div>
        </Page>
    );
};

export default PollPage;
