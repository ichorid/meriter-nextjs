'use client';

import { useEffect, useRef, useState, use } from "react";
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
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
import { useTranslations } from 'next-intl';

const SpacePage = ({ params }: { params: Promise<{ slug: string }> }) => {
    const router = useRouter();
    const t = useTranslations('pages');
    const resolvedParams = use(params);
    const spaceSlug = resolvedParams.slug;
    const pathname = `/meriter/spaces/${spaceSlug}`;

    const [paginationEnd, setPaginationEnd] = useState(false);
    const [showPollCreate, setShowPollCreate] = useState(false);

    const { data: space = {} } = useQuery({
        queryKey: ['space', spaceSlug],
        queryFn: async () => {
            if (!spaceSlug) return {};
            const response = await apiClient.get(`/api/rest/space?spaceSlug=${spaceSlug}`);
            return response;
        },
        enabled: !!spaceSlug,
        refetchOnWindowFocus: false,
    });

    const chatId = space?.chatId;

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        error: err
    } = useInfiniteQuery({
        queryKey: ['publications', 'spaces', spaceSlug],
        queryFn: async ({ pageParam = 0 }) => {
            const response = await apiClient.get(`/api/rest/publications/spaces/${spaceSlug}?skip=${5 * pageParam}&limit=5`);
            return response;
        },
        getNextPageParam: (lastPage, pages) => {
            if (!lastPage?.publications?.length) {
                setPaginationEnd(true);
                return undefined;
            }
            return pages.length;
        },
        initialPageParam: 0,
    });

    const publications = (data?.pages ?? [])
        .map((page: any) => page.publications)
        .flat()
        .filter((p: any, index: number, self: any[]) => 
            index === self.findIndex((t: any) => t?._id === p?._id)
        );

    const setJwt = data?.pages?.[0]?.setJwt;
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
        () => chatId ? `/api/rest/wallet?tgChatId=${chatId}` : null,
        0,
        { key: "balance" }
    );
    const [user] = swr("/api/rest/getme", { init: true });

    const [wallets, updateWallets] = swr(
        () => user?.token ? "/api/rest/wallet" : null,
        [],
        { key: "wallets" }
    );

    const [rank] = swr(
        () => spaceSlug && "/api/rest/rank?spaceSlug=" + spaceSlug,
        [],
        {
            key: "rank",
        }
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

    const [findTransaction, setFindTransaction] = useState<string | undefined>(undefined);
    useEffect(() => {
        if (document.location.search)
            setFindTransaction(document.location.search?.replace("#", ""));
    }, []);

    const cooldown = useRef(false);
    useEffect(() => {
        const fn = () => {
            if (
                window.innerHeight + window.scrollY >=
                document.body.offsetHeight
            ) {
                if (!paginationEnd && !cooldown.current) {
                    fetchNextPage();

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

    const tagRus = space?.tagRus ?? "";
    const [chat] = swr(
        () => chatId ? `/api/rest/getchat?chatId=${chatId}` : null,
        {},
        { key: "chat" }
    );

    const [comms] = swr(
        () => chatId ? `/api/rest/communityinfo?chatId=${chatId}` : null,
        {},
        { key: "comms" }
    );
    const chatName = chat?.username;
    const chatUrl = chat?.url;
    const chatNameVerb = String(chat?.title ?? "");
    const activeCommentHook = useState(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [rankLimit, setRankLimit] = useState(2 + 1);

    if (!user.token) return null;

    const tgAuthorId = user?.tgUserId;

    const onlyPublication =
        publications.filter((p: any) => p?.messageText)?.length == 1;

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
                    tagRus={tagRus}
                    chatNameVerb={chatNameVerb}
                    chatIcon={comms?.icon}
                />

                {error === false && (
                    <>
                        <div>
                            <div className="description">
                                {space?.description}
                            </div>
                            {chatUrl && (
                                <div className="tip">
                                    {t('spaces.toAddPublication')}{" "}
                                    <a href={chatUrl}>
                                        {" "}
                                        {t('spaces.writeMessageInChat')}
                                    </a>{" "}
                                    {t('spaces.withTag')} #{space?.tagRus}
                                    <br />
                                    <br />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </HeaderAvatarBalance>
            {error === true && <div>{t('spaces.noAccess')}</div>}

            <div className="mb-6">
                {spaceSlug && (
                    <h3 className="text-xl font-bold mb-4">{t('spaces.topPeople')}</h3>
                )}
                {spaceSlug &&
                    rank
                        ?.filter((r: any, i: number) => i < rankLimit)
                        ?.map((r: any) => (
                            <CardWithAvatar
                                key={r.tgUserId}
                                avatarUrl={telegramGetAvatarLink(r.tgUserId)}
                                userName={r.name}
                            >
                                <div className="font-medium">{r.name}</div>
                                <div className="text-sm opacity-60">
                                    {t('spaces.rating', { rating: r.rating })}
                                </div>
                            </CardWithAvatar>
                        ))}
                {spaceSlug &&
                    rank &&
                    rankLimit < rank.length && (
                        <button
                            onClick={() => setRankLimit(rankLimit + 20)}
                            className="btn btn-ghost btn-sm opacity-50"
                        >
                            {t('spaces.showMore')}
                        </button>
                    )}

                {spaceSlug && rank && rankLimit > 3 && (
                    <button
                        onClick={() => setRankLimit(2 + 1)}
                        className="btn btn-ghost btn-sm opacity-50 ml-2"
                    >
                        {t('spaces.collapse')}
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {spaceSlug && (
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold">{t('spaces.topPublications')}</h3>
                    </div>
                )}
                {user.token &&
                    publications
                        .filter((p: any) => p?.messageText || p?.type === 'poll')
                        .map((p: any) => (
                            <Publication
                                key={p._id}
                                {...p}
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
                                dimensionConfig={space.dimensionsConfig}
                                myId={user?.tgUserId}
                                onlyPublication={onlyPublication}
                                highlightTransactionId={findTransaction}
                                showCommunityAvatar={true}
                            />
                        ))}
                {!paginationEnd && publications.length > 1 && (
                    <button onClick={() => fetchNextPage()} className="btn btn-primary btn-wide mx-auto block">
                        {t('spaces.loadMore')}
                    </button>
                )}
            </div>
            {showPollCreate && (
                <BottomPortal>
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-5 overflow-y-auto">
                        <FormPollCreate
                            wallets={wallets}
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

export default SpacePage;

