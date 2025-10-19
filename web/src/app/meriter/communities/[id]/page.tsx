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
import { ThemeToggle } from "@shared/components/theme-toggle";

const CommunityPage = ({ params }: { params: Promise<{ id: string }> }) => {
    const router = useRouter();
    const resolvedParams = use(params);
    const chatId = resolvedParams.id;
    const pathname = `/meriter/communities/${chatId}`;

    const [paginationEnd, setPaginationEnd] = useState(false);
    const [showPollCreate, setShowPollCreate] = useState(false);

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

    const [wallets] = swr(
        () => user.token ? "/api/rest/wallet" : null,
        []
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
    const defaultHelpUrl = process.env.NEXT_PUBLIC_HELP_URL || "https://info.meriter.ru";
    const chatHelpUrl = chat?.helpUrl ?? defaultHelpUrl;
    const chatNameVerb = String(chat?.title ?? "");
    const activeCommentHook = useState(null);

    if (!user.token) return null;

    const tgAuthorId = user?.tgUserId;

    const onlyPublication =
        publications.filter((p) => p?.messageText)?.length == 1;

    return (
        <Page className="feed">
            <div className="flex justify-end items-center gap-2 opacity-50">
                <ThemeToggle />
                <span
                    className="cursor-pointer inline-flex items-center gap-1 hover:opacity-70"
                    onClick={() => (document.location.href = chatHelpUrl)}
                >
                    <img
                        className="h-5 w-5"
                        src={"/meriter/help.svg"}
                        alt="Help"
                    />
                    Помощь
                </span>
            </div>
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
                />

                {error === false && (
                    <>
                        <div>
                            {chatUrl && (
                                <div className="tip">
                                    Чтобы добавить сюда публикацию,{" "}
                                    <a href={chatUrl}>
                                        {" "}
                                        напишите сообщение в корпоративный чат
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
                                    Фильтр публикаций по ценностям:
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
            {error === true && <div>Нет доступа</div>}

            <div className="space-y-4">
                {user.token &&
                    publications
                        .filter((p) => p?.messageText || p?.type === 'poll')
                        .map((p) => (
                            <Publication
                                key={p._id}
                                {...p}
                                tgChatId={chatId}
                                balance={balance}
                                updBalance={updBalance}
                                activeCommentHook={activeCommentHook}
                                dimensionConfig={undefined}
                                myId={user?.tgUserId}
                                onlyPublication={onlyPublication}
                                highlightTransactionId={findTransaction}
                                isDetailPage={false}
                            />
                        ))}
                {!paginationEnd && publications.length > 1 && (
                    <button onClick={() => setSize(size + 1)} className="btn btn-primary btn-wide mx-auto block">
                        Загрузить еще
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

export default CommunityPage;

