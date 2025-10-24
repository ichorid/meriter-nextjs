'use client';

import Page from '@shared/components/page';
import { swr } from '@lib/swr';
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
import { Publication } from "@features/feed/components/publication";
import { Comment } from "@features/comments/components/comment";
import { FormPollCreate } from "@features/polls";
import { BottomPortal } from "@shared/components/bottom-portal";

interface iCommunityProps {
    name: string;
    description: string;
    balance: number;
    capitalization: number;
}

const verb = (w) => {
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
    const balance = [];
    const [myPublications, updatePublications] = swr(
        "/api/rest/publications/my?skip=0&limit=100",
        [],
        {
            key: "publications",
            revalidateOnFocus: false,
        }
    );
    const [myComments, updateComments] = swr(
        "/api/rest/transactions/my?positive=true",
        [],
        {
            key: "transactions",
            revalidateOnFocus: false,
        }
    );
    const [myUpdates, updateUpdates] = swr(
        "/api/rest/transactions/updates",
        [],
        {
            key: "transactions",
            revalidateOnFocus: false,
        }
    );
    const [wallets, updateWallets] = swr("/api/rest/getusercommunities", { communities: [] });

    // Debug SWR call
    console.log('🔧 SWR wallets call made, result:', wallets);
    console.log('🔧 SWR updateWallets function:', typeof updateWallets);

    // Debug logging for communities
    useEffect(() => {
        console.log('🏠 Home page - Communities data:', wallets);
        console.log('🏠 Home page - Communities count:', wallets?.communities?.length || 0);
        if (wallets?.communities) {
            console.log('🏠 Home page - Communities details:', wallets.communities.map(c => ({
                chatId: c.chatId,
                title: c.title,
                isAdmin: c.isAdmin,
                needsSetup: c.needsSetup
            })));
        }
    }, [wallets]);
    const [walletData, updateWalletData] = swr("/api/rest/wallet", [], {
        key: "walletData",
    });
    const [user] = swr("/api/rest/getme", {});
    const [tab, setTab] = useState("publications");
    const [sortBy, setSortBy] = useState<"recent" | "voted">("recent");
    const [showPollCreate, setShowPollCreate] = useState(false);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [showHelpCard, setShowHelpCard] = useState(true);
    const activeCommentHook = useState(null);

    const updateWalletBalance = (currencyOfCommunityTgChatId: string, amountChange: number) => {
        // Optimistically update wallet balance without reloading
        if (!Array.isArray(walletData)) return;
        
        const updatedWalletData = walletData.map((wallet) => {
            if (wallet.currencyOfCommunityTgChatId === currencyOfCommunityTgChatId) {
                return {
                    ...wallet,
                    amount: wallet.amount + amountChange,
                };
            }
            return wallet;
        });
        updateWalletData(updatedWalletData, false); // Update without revalidation
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
    }, [walletData]);

    // Reset active withdraw slider when switching tabs
    useEffect(() => {
        setActiveWithdrawPost(null);
    }, [tab]);

    const [userdata] = swr(
        () =>
            user.tgUserId
                ? `/api/rest/users/telegram/${user.tgUserId}/profile`
                : null,
        0,
        { key: "userdata" }
    );
    const tgAuthorId = user?.tgUserId;
    const authCheckDone = useRef(false);

    useEffect(() => {
        if (!authCheckDone.current && !user?.tgUserId && !user.init) {
            authCheckDone.current = true;
            router.push("/meriter/login?returnTo=" + encodeURIComponent(window.location.pathname));
        }
    }, [user, user?.init, router]);

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

    if (!user.token) {
        return null; // Loading or not authenticated
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
                balance1={{ icon: "", amount: balance }}
                balance2={undefined}
                avatarUrl={
                    user?.avatarUrl ?? telegramGetAvatarLink(tgAuthorId)
                }
                onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId)}
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
                <div className="heading">{t('myCommunities')}</div>
                {(() => {
                    console.log('🎨 Rendering communities - wallets:', wallets);
                    console.log('🎨 Rendering communities - communities array:', wallets?.communities);
                    console.log('🎨 Rendering communities - communities length:', wallets?.communities?.length);
                    
                    if (!wallets?.communities) {
                        console.log('🎨 No communities data available');
                        return <div>No communities data</div>;
                    }
                    
                    if (wallets.communities.length === 0) {
                        console.log('🎨 Communities array is empty');
                        return <div>No communities found</div>;
                    }
                    
                    return wallets.communities.map((community) => {
                        console.log('🎨 Rendering community:', community);
                        // Find corresponding wallet data for this community
                        const walletInfo = walletData?.find(w => w.currencyOfCommunityTgChatId === community.chatId);
                        return (
                            <WalletCommunity 
                                key={community._id} 
                                amount={walletInfo?.amount || 0}
                                currencyNames={walletInfo?.currencyNames || []}
                                currencyOfCommunityTgChatId={community.chatId}
                                tgUserId={user?.tgUserId}
                                isAdmin={community.isAdmin}
                                needsSetup={community.needsSetup}
                            />
                        );
                    });
                })()}
            </div>
            <div className="balance-inpublications">
                <div className="tabs tabs-boxed mb-4 p-1 bg-base-200 rounded-lg shadow-sm">
                    <a
                        className={classList(
                            "tab tab-lg gap-2 font-medium transition-all duration-200 hover:text-primary",
                            tab === "publications" && "tab-active bg-primary text-primary-content shadow-md"
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
                            tab === "comments" && "tab-active bg-primary text-primary-content shadow-md"
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
                            tab === "updates" && "tab-active bg-primary text-primary-content shadow-md"
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
                                sortBy === "recent" && "btn-active btn-primary"
                            )}
                            onClick={() => setSortBy("recent")}
                        >
                            {t('sort.recent')}
                        </button>
                        <button 
                            className={classList(
                                "join-item btn btn-sm font-medium transition-all duration-200",
                                sortBy === "voted" && "btn-active btn-primary"
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
                            {myUpdates &&
                                sortItems(myUpdates)
                                    .filter((p) => p.fromUserTgId !== user?.tgUserId)
                                    .map((p: any) => (
                                        <TransactionToMe key={p._id} transaction={p} />
                                    ))}
                        </div>
                    </div>
                )}
                {tab === "publications" && (
                    <div className="balance-inpublications-list">
                        <div className="balance-inpublications-publications">
                            {myPublications &&
                                sortItems(myPublications)
                                    .filter((p) => p.messageText || p.type === 'poll')
                                    .map((p) => (
                                        <Publication
                                            key={p._id || p.slug}
                                            {...p}
                                            myId={user?.tgUserId}
                                            updateAll={updateAll}
                                            updateWalletBalance={updateWalletBalance}
                                            wallets={walletData}
                                            showCommunityAvatar={true}
                                            activeWithdrawPost={activeWithdrawPost}
                                            setActiveWithdrawPost={setActiveWithdrawPost}
                                            activeSlider={activeSlider}
                                            setActiveSlider={setActiveSlider}
                                            activeCommentHook={activeCommentHook}
                                        />
                                    ))}
                        </div>
                    </div>
                )}
                {tab === "comments" && (
                    <div className="balance-inpublications-list">
                        <div className="balance-inpublications-filters"></div>
                        <div className="balance-inpublications-publications">
                            {myComments &&
                                sortItems(myComments)
                                    .map((p) => (
                                        <Comment
                                            key={p._id}
                                            {...p}
                                            _id={p._id}
                                            myId={user?.tgUserId}
                                            updateAll={updateAll}
                                            updateWalletBalance={updateWalletBalance}
                                            wallets={walletData}
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

