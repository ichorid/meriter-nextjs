'use client';

import Page from '@shared/components/page';
import { useEffect, useState, useRef } from "react";
import { useTranslations } from 'next-intl';
import { HeaderAvatarBalance } from '@shared/components/header-avatar-balance';
import { useRouter } from "next/navigation";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from '@lib/telegram';
import { MenuBreadcrumbs } from '@shared/components/menu-breadcrumbs';
import { classList } from '@lib/classList';
import { TransactionToMe } from "@features/wallet/components/transaction-to-me";
import { WalletCommunity } from "@features/wallet/components/wallet-community";
import { PublicationCard } from "@/components/organisms/Publication";
import { Comment } from "@features/comments/components/comment";
import { FormPollCreate } from "@features/polls";
import { BottomPortal } from "@shared/components/bottom-portal";
import { useMe, useMyPublications, useWallets, useTransactionUpdates, useUserProfile } from '@/hooks/api';

interface iCommunityProps {
    name: string;
    description: string;
    balance: number;
    capitalization: number;
}

const verb = (w: { amount: number; currencyNames: string[] }) => {
    const { amount, currencyNames } = w;
    if (amount === 0) return `0 ${currencyNames[5]}`;
    else if (amount === 1) return `1 ${currencyNames[1]}`;
    else if (amount === 2 || amount === 3 || amount === 4)
        return `${amount} ${currencyNames[2]}`;
    else return `${amount} ${currencyNames[5]}`;
};

const PageHome = () => {
    const router = useRouter();
    const t = useTranslations('home');
    const balance: number[] = [];
    
    // Use React Query hooks
    const { data: user, isLoading: userLoading } = useMe();
    const { data: myPublications = [], isLoading: publicationsLoading } = useMyPublications({ skip: 0, limit: 100 });
    const { data: wallets = [], isLoading: walletsLoading } = useWallets();
    const { data: myUpdates = [], isLoading: updatesLoading } = useTransactionUpdates();
    
    const [tab, setTab] = useState("publications");
    const [sortBy, setSortBy] = useState<"recent" | "voted">("recent");
    const [showPollCreate, setShowPollCreate] = useState(false);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [showHelpCard, setShowHelpCard] = useState(true);
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

    // Reset active withdraw slider when switching tabs
    useEffect(() => {
        setActiveWithdrawPost(null);
    }, [tab]);

    // Get user profile data
    const { data: userdata = 0 } = useUserProfile(user?.tgUserId || '');
    const tgAuthorId = user?.tgUserId;
    const authCheckDone = useRef(false);

    useEffect(() => {
        if (!authCheckDone.current && !userLoading && !user?.tgUserId) {
            authCheckDone.current = true;
            router.push("/meriter/login?returnTo=" + encodeURIComponent(window.location.pathname));
        }
    }, [user, userLoading, router]);

    // Check if help card was dismissed
    useEffect(() => {
        const dismissed = localStorage.getItem('help-card-dismissed');
        if (dismissed === 'true') {
            setShowHelpCard(false);
        }
    }, []);

    const dismissHelpCard = () => {
        localStorage.setItem('help-card-dismissed', 'true');
        setShowHelpCard(false);
    };

    if (userLoading || !user?.token) {
        return (
            <Page className="balance">
                <div className="flex justify-center items-center h-64">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            </Page>
        );
    }

    const sortItems = (items: any[]) => {
        if (!items) return [];
        return [...items].sort((a, b) => {
            if (sortBy === "recent") {
                return new Date(b.ts).getTime() - new Date(a.ts).getTime();
            } else {
                return (b.sum || 0) - (a.sum || 0);
            }
        });
    };

    return (
        <Page className="balance">
            <HeaderAvatarBalance
                balance1={undefined}
                balance2={undefined}
                avatarUrl={
                    user?.avatarUrl ?? telegramGetAvatarLink(tgAuthorId || '')
                }
                onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId || '')}
                onClick={() => {
                    router.push("/meriter/home");
                }}
                userName={user?.name || 'User'}
            >
                <MenuBreadcrumbs />
            </HeaderAvatarBalance>

            {/* Help Card */}
            {showHelpCard && (
                <div className="card bg-primary/10 border border-primary/20 shadow-lg mb-6">
                    <div className="card-body">
                        <div className="flex justify-between items-start">
                            <h3 className="card-title text-primary mb-2">{t('helpCard.title')}</h3>
                            <button 
                                onClick={dismissHelpCard}
                                className="btn btn-ghost btn-sm btn-circle"
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="text-sm mb-2">
                            {t('helpCard.content')}
                        </p>
                        <p className="text-xs opacity-70">
                            {t('helpCard.reviewInSettings')}
                        </p>
                    </div>
                </div>
            )}
            
            <div className="balance-available">
                {false && <div className="heading">{t('availableBalance')}</div>}
                {walletsLoading ? (
                    <div className="flex justify-center items-center h-32">
                        <span className="loading loading-spinner loading-lg"></span>
                    </div>
                ) : (
                    wallets && wallets.map((w: any) => (
                        <WalletCommunity key={w._id} {...w} />
                    ))
                )}
            </div>
            
            <div className="balance-inpublications">
                <div className="tabs tabs-boxed mb-4 p-1 bg-base-200 rounded-lg shadow-sm">
                    <a
                        className={classList(
                            "tab tab-lg gap-2 font-medium transition-all duration-200 hover:text-primary",
                            tab === "publications" ? "tab-active bg-primary text-primary-content shadow-md" : ""
                        )}
                        onClick={() => {
                            setTab("publications");
                        }}
                    >
                        {t('tabs.publications')}
                    </a>
                    <a
                        className={classList(
                            "tab tab-lg gap-2 font-medium transition-all duration-200 hover:text-primary",
                            tab === "comments" ? "tab-active bg-primary text-primary-content shadow-md" : ""
                        )}
                        onClick={() => {
                            setTab("comments");
                        }}
                    >
                        {t('tabs.comments')}
                    </a>
                    <a
                        className={classList(
                            "tab tab-lg gap-2 font-medium transition-all duration-200 hover:text-primary",
                            tab === "updates" ? "tab-active bg-primary text-primary-content shadow-md" : ""
                        )}
                        onClick={() => {
                            setTab("updates");
                        }}
                    >
                        {t('tabs.updates')}
                    </a>
                </div>
                
                <div className="flex justify-end mb-4">
                    <div className="join shadow-sm">
                        <button 
                            className={classList(
                                "join-item btn btn-sm font-medium transition-all duration-200",
                                sortBy === "recent" ? "btn-active btn-primary" : ""
                            )}
                            onClick={() => setSortBy("recent")}
                        >
                            {t('sort.recent')}
                        </button>
                        <button 
                            className={classList(
                                "join-item btn btn-sm font-medium transition-all duration-200",
                                sortBy === "voted" ? "btn-active btn-primary" : ""
                            )}
                            onClick={() => setSortBy("voted")}
                        >
                            {t('sort.voted')}
                        </button>
                    </div>
                </div>
                
                {tab === "updates" && (
                    <div className="balance-inpublications-list">
                        <div className="balance-inpublications-filters"></div>
                        <div className="balance-inpublications-publications">
                            {updatesLoading ? (
                                <div className="flex justify-center items-center h-32">
                                    <span className="loading loading-spinner loading-lg"></span>
                                </div>
                            ) : (
                                myUpdates &&
                                sortItems(myUpdates)
                                    .filter((p) => p.fromUserTgId !== user?.tgUserId)
                                    .map((p: any) => (
                                        <TransactionToMe key={p._id} transaction={p} />
                                    ))
                            )}
                        </div>
                    </div>
                )}
                
                {tab === "publications" && (
                    <div className="balance-inpublications-list">
                        <div className="balance-inpublications-publications">
                            {publicationsLoading ? (
                                <div className="flex justify-center items-center h-32">
                                    <span className="loading loading-spinner loading-lg"></span>
                                </div>
                            ) : (
                                sortItems(myPublications)
                                    .filter((p) => p.messageText || p.type === 'poll')
                                    .map((p) => (
                                        <PublicationCard
                                            key={p._id || p.slug}
                                            publication={p}
                                            wallets={wallets}
                                            showCommunityAvatar={true}
                                            updateAll={updateAll}
                                            updateWalletBalance={updateWalletBalance}
                                        />
                                    ))
                            )}
                        </div>
                    </div>
                )}
                
                {tab === "comments" && (
                    <div className="balance-inpublications-list">
                        <div className="balance-inpublications-filters"></div>
                        <div className="balance-inpublications-publications">
                            {myPublications &&
                                sortItems(myPublications)
                                    .filter((p) => p.type === 'comment')
                                    .map((p) => (
                                        <Comment
                                            key={p._id}
                                            {...p}
                                            _id={p._id}
                                            myId={user?.tgUserId}
                                            updateAll={updateAll}
                                            updateWalletBalance={updateWalletBalance}
                                            wallets={wallets}
                                            showCommunityAvatar={true}
                                            activeWithdrawPost={activeWithdrawPost}
                                            setActiveWithdrawPost={setActiveWithdrawPost}
                                            activeCommentHook={activeCommentHook}
                                            isDetailPage={false}
                                        />
                                    ))}
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
                            wallets={wallets}
                            onSuccess={(pollId) => {
                                setShowPollCreate(false);
                                updateAll();
                            }}
                            onCancel={() => setShowPollCreate(false)}
                        />
                    </div>
                </BottomPortal>
            )}
        </Page>
    );
};

export default PageHome;