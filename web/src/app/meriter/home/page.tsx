'use client';

import { useEffect, useState, useRef } from "react";
import { useTranslations } from 'next-intl';
import { useRouter } from "next/navigation";
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { PublicationCardComponent as PublicationCard } from "@/components/organisms/Publication";
import { FormPollCreate } from "@features/polls";
import { BottomPortal } from "@shared/components/bottom-portal";
import { useMyPublications, useWallets, useUserProfile } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';

const PageHome = () => {
    const router = useRouter();
    const t = useTranslations('home');
    
    // Use centralized auth context
    const { user, isLoading: userLoading, isAuthenticated } = useAuth();
    const { data: myPublications = [], isLoading: publicationsLoading } = useMyPublications({ skip: 0, limit: 100 });
    const { data: wallets = [], isLoading: walletsLoading } = useWallets();
    
    // Read tab and sort from URL hash
    const [currentTab, setCurrentTab] = useState<"publications" | "comments" | "updates">("publications");
    const [sortBy, setSortBy] = useState<"recent" | "voted">("recent");
    const [showPollCreate, setShowPollCreate] = useState(false);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const activeCommentHook = useState<string | null>(null);

    const updateWalletBalance = (currencyOfCommunityTgChatId: string, amountChange: number) => {
        // This will be handled by React Query mutations
        // Optimistic updates are handled in the hooks
    };

    const updateAll = async () => {
        // Close the active withdraw slider after successful update
        setActiveWithdrawPost(null);
    };
    
    useEffect(() => {
        if (document.location.search.match("updates")) {
            setTimeout(
                () => (document.location.href = "#updates-frequency"),
                500
            );
            setTimeout(
                () => (document.location.href = "#updates-frequency"),
                1000
            );
        }
    }, [wallets]);

    // Read tab and sort from URL hash
    useEffect(() => {
        const updateFromHash = () => {
            const hash = window.location.hash;
            
            // Parse tab from hash
            if (hash.includes('comments')) {
                setCurrentTab('comments');
            } else if (hash.includes('updates-frequency')) {
                setCurrentTab('updates');
            } else {
                setCurrentTab('publications');
            }
            
            // Parse sort from hash
            const urlParams = new URLSearchParams(hash.replace(/^#/, '').split('?')[1] || '');
            const sortParam = urlParams.get('sort');
            if (sortParam === 'voted') {
                setSortBy('voted');
            } else {
                setSortBy('recent');
            }
        };

        // Initial load
        updateFromHash();

        // Listen for hash changes
        window.addEventListener('hashchange', updateFromHash);
        return () => window.removeEventListener('hashchange', updateFromHash);
    }, []);

    // Reset active withdraw slider when switching tabs
    useEffect(() => {
        setActiveWithdrawPost(null);
    }, [currentTab]);

    // Get user profile data
    const { data: userdata = 0 } = useUserProfile(user?.id || '');
    const tgAuthorId = user?.id;
    const authCheckDone = useRef(false);

    useEffect(() => {
        if (!authCheckDone.current && !userLoading && !isAuthenticated) {
            authCheckDone.current = true;
            router.push("/meriter/login?returnTo=" + encodeURIComponent(window.location.pathname));
        }
    }, [isAuthenticated, userLoading, router]);

    if (userLoading || !isAuthenticated) {
        return (
            <AdaptiveLayout className="balance">
                <div className="flex justify-center items-center h-64">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            </AdaptiveLayout>
        );
    }

    const sortItems = (items: any[]) => {
        if (!items || !Array.isArray(items)) return [];
        return [...items].sort((a, b) => {
            if (sortBy === "recent") {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } else {
                return (b.metrics?.score || 0) - (a.metrics?.score || 0);
            }
        });
    };

    return (
        <AdaptiveLayout 
            className="balance"
            activeCommentHook={activeCommentHook}
            activeSlider={activeSlider}
            setActiveSlider={setActiveSlider}
            activeWithdrawPost={activeWithdrawPost}
            setActiveWithdrawPost={setActiveWithdrawPost}
            wallets={Array.isArray(wallets) ? wallets : []}
            updateWalletBalance={updateWalletBalance}
            updateAll={updateAll}
            myId={user?.id}
        >
            <div className="balance-inpublications">
                {currentTab === "updates" && (
                    <div className="balance-inpublications-list">
                        <div className="balance-inpublications-filters"></div>
                        <div className="balance-inpublications-publications">
                            <div className="flex justify-center items-center h-32">
                                <span className="text-gray-500">Updates feature coming soon</span>
                            </div>
                        </div>
                    </div>
                )}
                
                {currentTab === "publications" && (
                    <div className="balance-inpublications-list">
                        <div className="balance-inpublications-publications">
                            {publicationsLoading ? (
                                <div className="flex justify-center items-center h-32">
                                    <span className="loading loading-spinner loading-lg"></span>
                                </div>
                            ) : (
                                sortItems(myPublications || [])
                                    .filter((p) => {
                                        const passes = p.content || p.type === 'poll';
                                        console.log('Filtering publication:', {
                                            id: p.id,
                                            content: p.content,
                                            type: p.type,
                                            passes: passes
                                        });
                                        return passes;
                                    })
                                    .map((p) => (
                                        <PublicationCard
                                            key={p.id}
                                            publication={p}
                                            wallets={Array.isArray(wallets) ? wallets : []}
                                            showCommunityAvatar={true}
                                            updateAll={updateAll}
                                            updateWalletBalance={updateWalletBalance}
                                        />
                                    ))
                            )}
                        </div>
                    </div>
                )}
                
                {currentTab === "comments" && (
                    <div className="balance-inpublications-list">
                        <div className="balance-inpublications-filters"></div>
                        <div className="balance-inpublications-publications">
                            <div className="flex justify-center items-center h-32">
                                <span className="text-gray-500">Comments feature coming soon</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {showPollCreate && (
                <BottomPortal>
                    <div style={{ 
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: "20px",
                        overflowY: "auto"
                    }}>
                        <FormPollCreate
                            wallets={Array.isArray(wallets) ? wallets : []}
                            onSuccess={(pollId) => {
                                setShowPollCreate(false);
                                updateAll();
                            }}
                            onCancel={() => setShowPollCreate(false)}
                        />
                    </div>
                </BottomPortal>
            )}
        </AdaptiveLayout>
    );
};

export default PageHome;