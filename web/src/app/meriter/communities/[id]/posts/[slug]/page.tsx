'use client';

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useRouter } from "next/navigation";
import { Publication } from "@features/feed";
import { useAuth } from '@/contexts/AuthContext';
import { usePublication, useCommunity, useWallets } from '@/hooks/api';
import { useWalletBalance } from '@/hooks/api/useWallet';

const PostPage = ({ params }: { params: Promise<{ id: string; slug: string }> }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const resolvedParams = use(params);
    const chatId = resolvedParams.id;
    const slug = resolvedParams.slug;
    
    // Get highlight parameter from URL for comment highlighting
    const highlightCommentId = searchParams.get('highlight');

    // Use v1 API hooks
    const { user } = useAuth();
    const { data: publication, isLoading: publicationLoading, error: publicationError } = usePublication(slug);
    const { data: comms } = useCommunity(chatId);
    
    const { data: balance = 0 } = useWalletBalance(chatId);

    const { data: wallets = [] } = useWallets();

    const activeCommentHook = useState<string | null>(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.id) {
            router.push("/meriter/login?returnTo=" + encodeURIComponent(window.location.pathname));
        }
    }, [user, router]);

    // Auto-scroll to highlighted comment when page loads
    useEffect(() => {
        if (highlightCommentId && publication) {
            // Wait for comments to render, then scroll to highlighted comment
            const timer = setTimeout(() => {
                const highlightedElement = document.querySelector(`[data-comment-id="${highlightCommentId}"]`);
                if (highlightedElement) {
                    highlightedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Add a temporary highlight effect
                    highlightedElement.classList.add('highlight');
                    setTimeout(() => {
                        highlightedElement.classList.remove('highlight');
                    }, 3000);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [highlightCommentId, publication]);

    // if (!user?.token) return null;

    const tgAuthorId = user?.id;

    // Show loading state
    if (publicationLoading) {
        return (
            <AdaptiveLayout 
                className="feed"
                communityId={chatId}
                balance={balance}
                wallets={wallets}
                myId={user?.id}
                activeCommentHook={activeCommentHook}
                activeSlider={activeSlider}
                setActiveSlider={setActiveSlider}
                activeWithdrawPost={activeWithdrawPost}
                setActiveWithdrawPost={setActiveWithdrawPost}
            >
                <div className="flex justify-center items-center h-64">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            </AdaptiveLayout>
        );
    }

    // Show error state
    if (publicationError || !publication) {
        return (
            <AdaptiveLayout 
                className="feed"
                communityId={chatId}
                balance={balance}
                wallets={wallets}
                myId={user?.id}
                activeCommentHook={activeCommentHook}
                activeSlider={activeSlider}
                setActiveSlider={setActiveSlider}
                activeWithdrawPost={activeWithdrawPost}
                setActiveWithdrawPost={setActiveWithdrawPost}
            >
                <div className="flex flex-col items-center justify-center h-64">
                    <p className="text-error">Publication not found</p>
                    <button 
                        className="btn btn-primary mt-4"
                        onClick={() => router.push(`/meriter/communities/${chatId}`)}
                    >
                        Back to Community
                    </button>
                </div>
            </AdaptiveLayout>
        );
    }

    return (
        <AdaptiveLayout 
            className="feed"
            communityId={chatId}
            balance={balance}
            wallets={wallets}
            myId={user?.id}
            activeCommentHook={activeCommentHook}
            activeSlider={activeSlider}
            setActiveSlider={setActiveSlider}
            activeWithdrawPost={activeWithdrawPost}
            setActiveWithdrawPost={setActiveWithdrawPost}
        >
            <div className="space-y-4">
                {publication && (
                    <Publication
                        key={publication.id}
                        {...publication}
                        balance={balance}
                        activeCommentHook={activeCommentHook}
                        activeSlider={activeSlider}
                        setActiveSlider={setActiveSlider}
                        activeWithdrawPost={activeWithdrawPost}
                        setActiveWithdrawPost={setActiveWithdrawPost}
                        wallets={wallets}
                        dimensionConfig={undefined}
                        myId={user?.id}
                        onlyPublication={true}
                        highlightTransactionId={highlightCommentId || undefined}
                        isDetailPage={true}
                        showCommunityAvatar={false}
                    />
                )}
            </div>
        </AdaptiveLayout>
    );
};

export default PostPage;

