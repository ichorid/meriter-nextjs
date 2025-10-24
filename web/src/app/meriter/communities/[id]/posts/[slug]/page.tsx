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

const PostPage = ({ params }: { params: Promise<{ id: string; slug: string }> }) => {
    const router = useRouter();
    const t = useTranslations('pages');
    const resolvedParams = use(params);
    const chatId = resolvedParams.id;
    const slug = resolvedParams.slug;

    const { data: user = { init: true } } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const response = await apiClient.get('/api/rest/getme');
            return response;
        },
    });

    const { data: publication = {} } = useQuery({
        queryKey: ['publication', slug],
        queryFn: async () => {
            const response = await apiClient.get(`/api/rest/publications/${slug}`);
            return response;
        },
        enabled: !!user?.token,
    });

    const { data: chat = {} } = useQuery({
        queryKey: ['chat', chatId],
        queryFn: async () => {
            const response = await apiClient.get(`/api/rest/getchat?chatId=${chatId}`);
            return response;
        },
        enabled: !!user?.token,
    });

    const { data: comms = {} } = useQuery({
        queryKey: ['community-info', chatId],
        queryFn: async () => {
            const response = await apiClient.get(`/api/rest/communityinfo?chatId=${chatId}`);
            return response;
        },
        enabled: !!user?.token,
    });

    const { data: balance = 0 } = useQuery({
        queryKey: ['wallet', chatId],
        queryFn: async () => {
            const response = await apiClient.get(`/api/rest/wallet?tgChatId=${chatId}`);
            return response;
        },
        enabled: !!user?.token,
    });

    const { data: userdata = {} } = useQuery({
        queryKey: ['user-profile', user?.tgUserId],
        queryFn: async () => {
            const response = await apiClient.get(`/api/rest/users/telegram/${user.tgUserId}/profile`);
            return response;
        },
        enabled: !!user?.tgUserId,
    });

    const { data: wallets = [] } = useQuery({
        queryKey: ['wallets'],
        queryFn: async () => {
            const response = await apiClient.get('/api/rest/wallet');
            return response;
        },
        enabled: !!user?.token,
    });

    const queryClient = useQueryClient();

    const updateWalletBalance = (currencyOfCommunityTgChatId: string, amountChange: number) => {
        // Optimistically update wallet balance using React Query's cache
        queryClient.setQueryData(['wallets'], (oldWallets: any) => {
            if (!Array.isArray(oldWallets)) return oldWallets;
            
            return oldWallets.map((wallet) => {
                if (wallet.currencyOfCommunityTgChatId === currencyOfCommunityTgChatId) {
                    return {
                        ...wallet,
                        amount: wallet.amount + amountChange,
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
    
    // Clean post text for breadcrumb: remove hashtags and /ben: commands
    const getCleanPostText = (text: string) => {
        if (!text) return '';
        return text
            .replace(/#\w+/g, '') // Remove hashtags
            .replace(/\/ben:@?\w+/g, '') // Remove /ben: commands
            .trim();
    };

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
                    postText={publication?.messageText ? ellipsize(getCleanPostText(publication.messageText), 60) : ''}
                />
            </HeaderAvatarBalance>

            <div className="space-y-4">
                {publication && publication.messageText && (
                    <Publication
                        key={publication._id}
                        {...publication}
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

export default PostPage;

