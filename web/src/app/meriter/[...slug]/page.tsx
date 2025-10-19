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
import axios from "axios";
import { FormPollCreate } from "@features/polls";
import { BottomPortal } from "@shared/components/bottom-portal";
import { ThemeToggle } from "@shared/components/theme-toggle";

// App Router: Props come from params directly

const { round } = Math;

const classList = (
    ...classes: (string | { [key: string]: boolean })[]
) => {
    return (
        classes &&
        classes
            .filter((cls) => cls && typeof cls !== "undefined")
            .map((cls) =>
                typeof cls == "object"
                    ? cls[Object.keys(cls)[0]]
                        ? Object.keys(cls)[0]
                        : "undefined"
                    : cls
            )
            .filter((c) => c != "undefined")
            .map((c) => c.toLowerCase())
            .join(" ")
    );
};

const MeriterPage = ({ params }: { params: Promise<{ slug: string[] }> }) => {
    const router = useRouter();
    const resolvedParams = use(params);
    // slug is now an array of segments from the catch-all route
    const page = resolvedParams.slug;
    const pathname = "/" + page.join("/");

    const [paginationEnd, setPaginationEnd] = useState(false);
    const [showPollCreate, setShowPollCreate] = useState(false);

    const getKeyPublications = (pathname) => (pageIndex, previousPageData) => {
        if (previousPageData && !previousPageData?.publications.length) {
            setPaginationEnd(true);
            return null;
        } // reached the end}}
        return `/api/rest/publicationsinf?path=${pathname}&skip=${
            5 * pageIndex
        }&limit=5`; // SWR key
    };

    const comm = page?.[0] === "c";
    const isPublication = page && page?.[0] !== "c" && page?.[1];

    const spaceSlug = comm ? null : page?.[0];
    const [space] = swr(
        () => spaceSlug && "/api/rest/space?spaceSlug=" + spaceSlug,
        {},
        {
            key: "space",
            revalidateOnFocus: false,
        }
    );

    const contentId = page?.[1];
    const chatId = space?.chatId ?? page?.[1];

    const [comms] = swr(
        () => comm && "/api/rest/communityinfo?chatId=" + page[1],
        {}
    );

    const [content, size, setSize, err]: any = swrInfinite(
        getKeyPublications(pathname),
        []
    );

    const publications = ((content as IPublication[] | any)??[])
        .map((c) => (c as any).publications)
        .flat()
        .filter((p, index, self) => 
            // Deduplicate by _id to prevent duplicate keys
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

    /*const [content] = swr(() => '/api/d/meriter/publications?path=' + pathname, {
        publications: [],
    })*/

    const [balance, updBalance] = swr(
        () => "/api/rest/wallet?tgChatId=" + chatId,
        0,
        { key: "balance" }
    );
    const [user] = swr("/api/rest/getme", { init: true });

    const [wallets] = swr(
        () => user.token ? "/api/rest/wallet" : null,
        []
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
            "/api/userdata?action=userdataGetByTelegramId&telegramUserId=" +
            user?.tgUserId,
        0,
        { key: "userdata" }
    );

    const [findTransaction, setFindTransaction] = useState(undefined);
    useEffect(() => {
        if (document.location.search)
            setFindTransaction(document.location.search?.replace("#", ""));
    }, []);

    /* const [pathname, setPathname] = useState('')
    useEffect(() => {
        setPathname(document.location.pathname)
    }, [])*/
    const cooldown = useRef(false);
    const sizeRef = useRef(size);
    useEffect(() => {
        const fn = () => {
            if (
                window.innerHeight + window.scrollY >=
                document.body.offsetHeight
            ) {
                // you're at the bottom of the page
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

    const tagRus = space?.tagRus ?? "";
    const [chat] = swr(
        "/api/rest/getchat?chatId=" + chatId,
        {},
        { key: "chat" }
    );
    const chatName = chat?.username;
    const chatUrl = chat?.url;
    const defaultHelpUrl = process.env.NEXT_PUBLIC_HELP_URL || "https://info.meriter.ru";
    const chatHelpUrl = chat?.helpUrl ?? defaultHelpUrl;
    //const chatId = chat?.id
    const chatNameVerb = String(chat?.title ?? "");
    const activeCommentHook = useState(null);
    const [rankLimit, setRankLimit] = useState(2 + 1);
    //const [portalContent,setPortalContent] = useState(null);

    //const path = document.location.pathname.split('/');

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
                    router.push("/meriter/balance");
                }}
            >
                <MenuBreadcrumbs
                    pathname={pathname}
                    chatId={chatId}
                    tagRus={tagRus}
                    chatNameVerb={chatNameVerb}
                />

                {error === false && (
                    <>
                        <div>
                            {!comm && (
                                <div className="description">
                                    {space?.description}
                                </div>
                            )}
                            {!comm && chatUrl && (
                                <div className="tip">
                                    Чтобы добавить сюда публикацию,{" "}
                                    <a href={chatUrl}>
                                        {" "}
                                        напишите сообщение в корпоративный чат
                                    </a>{" "}
                                    с тэгом #{space?.tagRus}
                                    <br />
                                    <br />
                                </div>
                            )}
                            {comm && chatUrl && (
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
                                        onClick={() =>
                                            router.push("/meriter/" + space.slug)
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

            <div className="mb-6">
                {spaceSlug && !isPublication && (
                    <h3 className="text-xl font-bold mb-4">Топ людей:</h3>
                )}
                {spaceSlug &&
                    !isPublication &&
                    rank
                        ?.filter((r, i) => i < rankLimit)
                        ?.map((r) => (
                            <CardWithAvatar
                                key={r.tgUserId}
                                avatarUrl={telegramGetAvatarLink(r.tgUserId)}
                            >
                                <div className="font-medium">{r.name}</div>
                                <div className="text-sm opacity-60">
                                    Рейтинг: {r.rating}
                                </div>
                            </CardWithAvatar>
                        ))}
                {spaceSlug &&
                    !isPublication &&
                    rank &&
                    rankLimit < rank.length && (
                        <button
                            onClick={() => setRankLimit(rankLimit + 20)}
                            className="btn btn-ghost btn-sm opacity-50"
                        >
                            Показать больше
                        </button>
                    )}

                {spaceSlug && !isPublication && rank && rankLimit > 3 && (
                    <button
                        onClick={() => setRankLimit(2 + 1)}
                        className="btn btn-ghost btn-sm opacity-50 ml-2"
                    >
                        Свернуть
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {spaceSlug && !isPublication && (
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold">Топ публикаций:</h3>
                        {user.token && wallets.length > 0 && (
                            <button
                                onClick={() => setShowPollCreate(true)}
                                className="btn btn-success btn-sm gap-2"
                            >
                                📊 Создать опрос
                            </button>
                        )}
                    </div>
                )}
                {user.token &&
                    publications
                        .filter((p) => p?.messageText || p?.type === 'poll')
                        .map((p) => (
                            <Publication
                                key={p._id}
                                {...p}
                                balance={balance}
                                updBalance={updBalance}
                                activeCommentHook={activeCommentHook}
                                dimensionConfig={space.dimensionsConfig}
                                myId={user?.tgUserId}
                                onlyPublication={onlyPublication}
                                highlightTransactionId={findTransaction}
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

export default MeriterPage;
