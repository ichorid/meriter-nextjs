'use client';

import { useEffect, useRef, useState, use } from "react";
import { swr, swrInfinite } from '@lib/swr';
import Page from '@shared/components/page';
import { useRouter } from "next/navigation";
import { HeaderAvatarBalance } from '@shared/components/header-avatar-balance';
import { MenuBreadcrumbs } from '@shared/components/menu-breadcrumbs';
import { CardWithAvatar } from '@shared/components/card-with-avatar';
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from '@lib/telegram';
import { Publication } from "@features/feed";
import type { Publication as IPublication } from "@features/feed/types";
import { FormPollCreate } from "@features/polls";
import { BottomPortal } from "@shared/components/bottom-portal";
import { useTranslation } from 'react-i18next';
import { CommunityAvatar } from "@shared/components/community-avatar";
import { classList } from "@lib/classList";

const CommunityPage = ({ params }: { params: Promise<{ id: string }> }) => {
    const router = useRouter();
    const { t } = useTranslation('pages');
    const resolvedParams = use(params);
    const chatId = resolvedParams.id;
    const pathname = `/meriter/communities/${chatId}`;

    const [paginationEnd, setPaginationEnd] = useState(false);
    const [showPollCreate, setShowPollCreate] = useState(false);
    const [sortBy, setSortBy] = useState<"recent" | "voted">("recent");

    const getKeyPublications = (chatId) => (pageIndex, previousPageData) => {
        if (previousPageData && !previousPageData?.publications.length) {
            setPaginationEnd(true);
            return null;
        }
        return `/api/rest/publications/communities/${chatId}?skip=${
            5 * pageIndex
        }&limit=5`;
    };

    const [comms] = swr(
        () => `/api/rest/communityinfo?chatId=${chatId}`,
        {}
    );

    const [content, size, setSize, err]: any = swrInfinite(
        getKeyPublications(chatId),
        []
    );

    const publications = ((content as IPublication[] | any)??[])
        .map((c) => (c as any).publications)
        .flat()
        .filter((p, index, self) => 
            index === self.findIndex((t) => t?._id === p?._id)
        );

    const setJwt = (content as any ??[])?.[0]?.setJwt;
    useEffect(() => {
        if (setJwt) {
            document.location.href = "/auth/" + setJwt;
        }
    }, [setJwt]);

    const error =
        (content??[])?.[0]?.error || err
            ? true
            : content.length > 0
            ? false
            : undefined;

    const [balance, updBalance] = swr(
        () => `/api/rest/wallet?tgChatId=${chatId}`,
        0,
        { key: "balance" }
    );
    const [user] = swr("/api/rest/getme", { init: true });

    const [wallets, updateWallets] = swr(
        () => user.token ? "/api/rest/wallet" : null,
        [],
        { key: "wallets" }
    );

    useEffect(() => {
        if (!user?.tgUserId && !user.init)
            router.push("/meriter/login?returnTo=" + encodeURIComponent(document.location.pathname));
    }, [user, user?.init]);

    const [userdata] = swr(
        () =>
            user?.tgUserId
                ? `/api/rest/users/telegram/${user.tgUserId}/profile`
                : null,
        0,
        { key: "userdata" }
    );

    const [findTransaction, setFindTransaction] = useState(undefined);
    useEffect(() => {
        if (document.location.search)
            setFindTransaction(document.location.search?.replace("#", ""));
    }, []);

    const cooldown = useRef(false);
    const sizeRef = useRef(size);
    useEffect(() => {
        const fn = () => {
            if (
                window.innerHeight + window.scrollY >=
                document.body.offsetHeight
            ) {
                if (!paginationEnd && !cooldown.current) {
                    setSize(sizeRef.current + 1);
                    sizeRef.current++;

                    cooldown.current = true;
                    setTimeout(() => {
                        cooldown.current = false;
                    }, 500);
                }
            }
        };
        window.addEventListener("scroll", fn);
        return () => window.removeEventListener("scroll", fn);
    }, []);

    const [chat] = swr(
        `/api/rest/getchat?chatId=${chatId}`,
        {},
        { key: "chat" }
    );
    const chatName = chat?.username;
    const chatUrl = chat?.url;
    const chatNameVerb = String(chat?.title ?? "");
    const activeCommentHook = useState(null);
    
    // State for withdrawal functionality
    const [activeWithdrawPost, setActiveWithdrawPost] = useState(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    
    // Wallet update function for optimistic updates
    const updateWalletBalance = (currencyId: string, change: number) => {
        // Optimistically update wallet balance in SWR cache
        if (!Array.isArray(wallets)) return;
        
        const updatedWallets = wallets.map((wallet: any) => {
            if (wallet.currencyOfCommunityTgChatId === currencyId) {
                return {
                    ...wallet,
                    amount: wallet.amount + change,
                };
            }
            return wallet;
        });
        updateWallets(updatedWallets, false); // Update SWR cache without revalidation
    };
    
    const updateAll = async () => {
        // Trigger SWR revalidation
        await updateWallets();
        await updBalance();
    };

    if (!user.token) return null;

    const tgAuthorId = user?.tgUserId;

    const onlyPublication =
        publications.filter((p) => p?.messageText)?.length == 1;

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
        <Page className="feed">
            <HeaderAvatarBalance
                balance1={undefined}
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
                />
                
                {/* Community Header */}
                {chat?.title && (
                    <div className="py-3 border-b border-base-300 mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <CommunityAvatar
                                    avatarUrl={chat?.photo}
                                    communityName={chat?.title}
                                    size={48}
                                />
                                <h1 className="text-xl font-semibold">{chat?.title}</h1>
                            </div>
                            {/* Settings cog icon - visible only to admins */}
                            {comms?.chat?.administratorsIds?.includes(user?.tgUserId) && (
                                <button
                                    onClick={() => router.push(`/meriter/communities/${chatId}/settings`)}
                                    className="btn btn-ghost btn-sm btn-circle"
                                    title="Community Settings"
                                >
                                    <svg 
                                        className="w-5 h-5" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                    >
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={2} 
                                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
                                        />
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={2} 
                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
                                        />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {comms?.icon && (
                                <div className="flex items-center gap-2">
                                    <img className="w-5 h-5" src={comms.icon} alt="Currency" />
                                    <span className="text-lg font-semibold">{balance}</span>
                                </div>
                            )}
                            {comms?.chat?.tags && comms.chat.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {comms.chat.tags.map((tag: string, i: number) => (
                                        <span key={i} className="badge badge-primary badge-sm">#{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {error === false && (
                    <>
                        <div>
                            {chatUrl && (
                                <div className="tip">
                                    {t('communities.toAddPublication')}{" "}
                                    <a href={chatUrl}>
                                        {" "}
                                        {t('communities.writeMessageInChat')}
                                    </a>{" "}
                                    <br />
                                    <br />
                                </div>
                            )}
                            {comms.spaces && (
                                <div
                                    style={{
                                        paddingBottom: "15px",
                                        opacity: ".5",
                                    }}
                                >
                                    {t('communities.filterByValues')}
                                </div>
                            )}
                            {comms.spaces &&
                                comms.spaces.map((space) => (
                                    <CardWithAvatar
                                        key={space.slug}
                                        avatarUrl=""
                                        userName={space.tagRus || 'Space'}
                                        onClick={() =>
                                            router.push("/meriter/spaces/" + space.slug)
                                        }
                                    >
                                        <div className="heading">
                                            #{space.tagRus}
                                        </div>
                                        <div className="description">
                                            {space.description}
                                        </div>
                                    </CardWithAvatar>
                                ))}
                        </div>
                    </>
                )}
            </HeaderAvatarBalance>
            {error === true && <div>{t('communities.noAccess')}</div>}

            <button
                className="create-poll-button"
                onClick={() => setShowPollCreate(true)}
                style={{
                    padding: "10px 20px",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                    marginBottom: "15px",
                    width: "100%"
                }}
            >
                {t('communities.createPoll')}
            </button>

            <div className="flex justify-end mb-4">
                <div className="join shadow-sm">
                    <button 
                        className={classList(
                            "join-item btn btn-sm font-medium transition-all duration-200",
                            sortBy === "recent" && "btn-active btn-primary"
                        )}
                        onClick={() => setSortBy("recent")}
                    >
                        {t('communities.byDate')}
                    </button>
                    <button 
                        className={classList(
                            "join-item btn btn-sm font-medium transition-all duration-200",
                            sortBy === "voted" && "btn-active btn-primary"
                        )}
                        onClick={() => setSortBy("voted")}
                    >
                        {t('communities.byRating')}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {user.token &&
                    sortItems(publications)
                        .filter((p) => p?.messageText || p?.type === 'poll')
                        .map((p) => (
                            <Publication
                                key={p._id}
                                {...p}
                                tgChatId={chatId}
                                balance={balance}
                                updBalance={updBalance}
                                activeCommentHook={activeCommentHook}
                                activeSlider={activeSlider}
                                setActiveSlider={setActiveSlider}
                                dimensionConfig={undefined}
                                myId={user?.tgUserId}
                                onlyPublication={onlyPublication}
                                highlightTransactionId={findTransaction}
                                isDetailPage={false}
                                showCommunityAvatar={false}
                                wallets={wallets}
                                updateWalletBalance={updateWalletBalance}
                                activeWithdrawPost={activeWithdrawPost}
                                setActiveWithdrawPost={setActiveWithdrawPost}
                                updateAll={updateAll}
                            />
                        ))}
                {!paginationEnd && publications.length > 1 && (
                    <button onClick={() => setSize(size + 1)} className="btn btn-primary btn-wide mx-auto block">
                        {t('communities.loadMore')}
                    </button>
                )}
            </div>
            {showPollCreate && (
                <BottomPortal>
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-5 overflow-y-auto">
                        <FormPollCreate
                            communityId={chatId}
                            onSuccess={(pollId) => {
                                setShowPollCreate(false);
                                window.location.reload();
                            }}
                            onCancel={() => setShowPollCreate(false)}
                        />
                    </div>
                </BottomPortal>
            )}
        </Page>
    );
};

export default CommunityPage;

