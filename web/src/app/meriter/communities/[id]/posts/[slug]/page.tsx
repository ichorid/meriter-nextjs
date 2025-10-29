'use client';

import { use, useEffect, useState } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useRouter } from "next/navigation";
import { Publication } from "@features/feed";
import { useAuth } from '@/contexts/AuthContext';
import { usePublication, useCommunity, useUserProfile, useWallets } from '@/hooks/api';
import { useWalletBalance, walletKeys } from '@/hooks/api/useWallet';
import { queryKeys } from '@/lib/constants/queryKeys';

const PostPage = ({ params }: { params: Promise<{ id: string; slug: string }> }) => {
    const router = useRouter();
    const resolvedParams = use(params);
    const chatId = resolvedParams.id;
    const slug = resolvedParams.slug;

    // Use v1 API hooks
    const { user } = useAuth();
    const { data: publication } = usePublication(slug);
    const { data: comms } = useCommunity(chatId);
    
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
        await queryClient.invalidateQueries({ queryKey: walletKeys.balance(chatId) });
    };

    const updBalance = async () => {
        // Invalidate balance query to refresh
        await queryClient.invalidateQueries({ queryKey: walletKeys.balance(chatId) });
    };

    const activeCommentHook = useState<string | null>(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.id) {
            router.push("/meriter/login?returnTo=" + encodeURIComponent(window.location.pathname));
        }
    }, [user, router]);

    // if (!user?.token) return null;

    const tgAuthorId = user?.id;

    return (
        <AdaptiveLayout 
            className="feed"
            communityId={chatId}
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
                        myId={user?.id}
                        onlyPublication={true}
                        highlightTransactionId={undefined}
                        isDetailPage={true}
                        showCommunityAvatar={false}
                    />
                )}
            </div>
        </AdaptiveLayout>
    );
};

export default PostPage;

