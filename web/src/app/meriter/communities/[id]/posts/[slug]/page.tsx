'use client';

import { use, useEffect, useState } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Page from '@shared/components/page';
import { useRouter } from "next/navigation";
import { Publication } from "@features/feed";
import { useAuth } from '@/contexts/AuthContext';
import { usePublication, useCommunity, useUserProfile, useWallets } from '@/hooks/api';
import { usersApiV1 } from '@/lib/api/v1';

const PostPage = ({ params }: { params: Promise<{ id: string; slug: string }> }) => {
    const router = useRouter();
    const resolvedParams = use(params);
    const chatId = resolvedParams.id;
    const slug = resolvedParams.slug;

    // Use v1 API hooks
    const { user } = useAuth();
    const { data: publication } = usePublication(slug);
    const { data: comms } = useCommunity(chatId);
    
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

    const activeCommentHook = useState(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.telegramId) {
            router.push("/meriter/login?returnTo=" + encodeURIComponent(window.location.pathname));
        }
    }, [user, router]);

    // if (!user?.token) return null;

    const tgAuthorId = user?.telegramId;

    return (
        <Page className="feed">
            <div className="space-y-4">
                {publication && publication.content && (
                    <Publication
                        key={publication.id}
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
                        myId={user?.telegramId}
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

