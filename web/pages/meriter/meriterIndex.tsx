import { BOT_USERNAME } from "projects/meriter/config";
import Page from "projects/meriter/components/page";
import { swr } from "utils/swr";
import Router from "next/router";
import { CardWithAvatar } from "frontend/card-with-avatar";
import { telegramGetAvatarLink } from "bots/telegram/telegramapi";
import { useEffect, useState } from "react";

const CardCommunity = ({ h, d, rating }) => {
    return (
        <div className="card-community">
            <div className="content">
                <div className="h">{h}</div>
                <div className="d">{d}</div>
            </div>
            <div className="rating">{rating}</div>
        </div>
    );
};

const PageMeriterIndex = () => {
    const addr = BOT_USERNAME;
    const [communities] = swr("/api/d/meriter/communities", [], {
        key: "communities",
    });
    const [hide, setHide] = useState(true);
    useEffect(() => {
        if (document.location.search.match("show")) setHide(false);
    }, []);

    //const communities = []

    return (
        <Page className="index">
            {false && (
                <section className="cover">
                    <div className="h">
                        Запустите экономику заслуг в своем сообществе
                    </div>
                    <div className="t">
                        1.{" "}
                        <a href={`https://t.me/${addr}?start=community`}>
                            Подключите бота
                        </a>{" "}
                        к телеграм-чату сообщества
                    </div>
                    <div className="t">
                        2. Получите рейтинг самых ценных публикаций и авторов по
                        мнению участников сообщества
                    </div>
                    <div className="t">
                        3. Если сообщество делает что-то общественно полезное,
                        авторы смогут обменять баллы заслуг на различные услуги
                        других людей сообществ.
                    </div>
                </section>
            )}

            <section className="communities">
                <div className="h">Чаты</div>
                <div className="list">
                    {communities
                        .filter(
                            (c) =>
                                !hide ||
                                (![
                                    "-123123",
                                    "-123123",
                                    "-123123",
                                    "-123123",
                                ].includes(c.chatId ?? "") &&
                                    !String(c.title)
                                        .toLowerCase()
                                        .match("тест"))
                        )
                        .map((c) => ({
                            h: c.title,
                            d: c.description,
                            chatId: c.chatId,
                            rating: "",
                        }))
                        .map((c) => (
                            <div
                                className="clickable"
                                onClick={() => {
                                    console.log("/mt/c/" + c.chatId);
                                    Router.push("/mt/c/" + c.chatId);
                                }}
                            >
                                <CardWithAvatar
                                    avatarUrl={telegramGetAvatarLink(c.chatId)}
                                >
                                    <div className="heading">{c.h}</div>
                                    <div className="description">{c.d}</div>
                                </CardWithAvatar>
                            </div>
                        ))}
                </div>
            </section>

            {false && (
                <div>
                    <br />
                    <a href={`https://t.me/${addr}?start=auth`}>Войти</a>
                    <br />
                    <a href={`/api/d/meriter/logout`}>Выйти</a>
                </div>
            )}
        </Page>
    );
};

export default PageMeriterIndex;
