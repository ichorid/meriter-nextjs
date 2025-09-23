import { useEffect, useRef, useState } from "react";
import { swr, swrInfinite } from "utils/swr";
import Page from "projects/meriter/components/page";
import Router from "next/router";
import { HeaderAvatarBalance } from "frontend/header-avatar-balance";
import { MenuBreadcrumbs } from "frontend/menu-breadcrumbs";
import { CardWithAvatar } from "frontend/card-with-avatar";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from "bots/telegram/telegramapi";
import { IPublication, Publication } from "../../components/publication";
import axios from "axios";

export function getServerSideProps(ctx) {
    return {
        props: ctx.query,
    };
}

const { round } = Math;

export const classList = (
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

const MeriterPage = ({ page }) => {
    const pathname = "/" + page.join("/");

    const [paginationEnd, setPaginationEnd] = useState(false);

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
        .flat();

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

    const [rank] = swr(
        () => spaceSlug && "/api/rest/rank?spaceSlug=" + spaceSlug,
        [],
        {
            key: "rank",
        }
    );

    useEffect(() => {
        if (!user?.tgUserId && !user.init)
            Router.push("/mt/login?" + document.location.pathname);
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
    const chatHelpUrl = chat?.helpUrl ?? "https://info.example.com";
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
            <div style={{ textAlign: "right", opacity: ".5" }}>
                <span
                    style={{ cursor: "pointer" }}
                    onClick={() => (document.location.href = chatHelpUrl)}
                >
                    <img
                        style={{ height: "1.2em", marginBottom: "-0.3em" }}
                        src={"/meriter/help.svg"}
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
                    Router.push("/mt/balance");
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
                                            Router.push("/mt/" + space.slug)
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

            <div className="rank">
                {spaceSlug && !isPublication && (
                    <h3 className="heading">Топ людей:</h3>
                )}
                {spaceSlug &&
                    !isPublication &&
                    rank
                        ?.filter((r, i) => i < rankLimit)
                        ?.map((r) => (
                            <CardWithAvatar
                                avatarUrl={telegramGetAvatarLink(r.tgUserId)}
                            >
                                <div className="heading">{r.name}</div>
                                <div className="description">
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
                            style={{ opacity: 0.5 }}
                        >
                            Показать больше
                        </button>
                    )}

                {spaceSlug && !isPublication && rank && rankLimit > 3 && (
                    <button
                        onClick={() => setRankLimit(2 + 1)}
                        style={{ opacity: 0.5 }}
                    >
                        Свернуть
                    </button>
                )}
            </div>

            <div className="chatmessages">
                {spaceSlug && !isPublication && (
                    <h3 className="heading">Топ публикаций:</h3>
                )}
                {user.token &&
                    publications
                        .filter((p) => p?.messageText)
                        .map((p) => (
                            <Publication
                                key={p.slug}
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
                    <button onClick={() => setSize(size + 1)}>
                        Загрузить еще
                    </button>
                )}
            </div>
        </Page>
    );
};

export default MeriterPage;
