'use client';

import { swr } from '@lib/swr';
import { useEffect, useState } from "react";
import Axios from "axios";
import { etv } from '@shared/lib/input-utils';
import { nanoid } from "nanoid";

import { DivFade } from '@shared/components/transitions';
import Page from '@shared/components/page';
import { Spinner } from '@shared/components/misc';
import { IconPicker } from '@shared/components/iconpicker';
import { HeaderAvatarBalance } from '@shared/components/header-avatar-balance';
import { MenuBreadcrumbs } from '@shared/components/menu-breadcrumbs';
import { useRouter } from "next/navigation";
import { CardWithAvatar } from '@shared/components/card-with-avatar';
import { AccordeonWithSummary } from '@features/communities/components/accordeon-with-summary';
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from '@lib/telegram';
import { ThemeToggle } from "@shared/components/theme-toggle";

const Chat = ({ name, chatId, title, description, opened, onClick }: any) => {
    const [spaces, setSpaces] = useState([]);
    const [icon, setIcon] = useState("");
    const [currencyNames, setCurrencyNamesV] = useState({});
    const setCurrencyNames = (i) => (v) => {
        setCurrencyNamesV({ ...currencyNames, [i]: v });
        setCanSend(false);
    };

    const setVal = (idx, key) => (val) => {
        let spacesNew = [...spaces];
        spacesNew[idx] = { ...spacesNew[idx], [key]: val };
        setSpaces(spacesNew);
        setCanSend(false);
    };

    useEffect(() => {
        Axios.get("/api/rest/communityinfo?chatId=" + chatId)
            .then((d) => d.data)
            .then((d) => {
                setSpaces(d.spaces.filter((d) => !d.deleted));
                setIcon(d.icon);
                setCurrencyNamesV(d.currencyNames ?? {});
            });
    }, []);
    const addnew = () => {
        setSpaces([...spaces, { slug: nanoid(8) }]);
        setCanSend(false);
    };
    const del = (idx) => () => {
        let spacesNew = [...spaces];
        spaces[idx].deleted = true;
        setSpaces(spacesNew);
        setCanSend(false);
    };
    const [error, setError] = useState("");
    const [canSend, setCanSend] = useState(false);
    const [loading, setLoading] = useState(false);
    const [info, setInfo] = useState("");
    const [expanded, setExpanded] = useState();
    const sendMemo = (self = false) => {
        setLoading(true);
        Axios.post(
            `/api/rest/sendmemo?self=${self ? "true" : "false"}&chatId=` +
                chatId,
            { spaces }
        ).then(() => {
            setLoading(false);
            setInfo("Памятка выслана!");
            setTimeout(() => {
                setInfo("");
            }, 1000);
        });
    };

    const save = () => {
        //if (!(currencyNames[1] && currencyNames[2] && currencyNames[5])) return setError("задайте все три названия валюты заслуг");
        if (spaces.length === 0)
            return setError("добавьте хотя бы одну ценность сообщества");

        setError("");
        setLoading(true);
        Axios.post("/api/rest/communityinfo?chatId=" + chatId, {
            spaces: spaces.filter((d) => d.tagRus && !d.deleted),
            icon,
            currencyNames,
        }).then(() => {
            setCanSend(true);
            setLoading(false);
        });
    };

    return (
        <div className="chateditor">
            <CardWithAvatar onClick={onClick}>
                <div className="title">{title}</div>
                {false && <a href={"https://t.me/" + name}></a>}
                <div className="description">{description}</div>

                {false && (
                    <a href={"/commbalance?chatId=" + chatId}>
                        Баланс в меритере
                    </a>
                )}
            </CardWithAvatar>

            {opened && (
                <div>
                    <AccordeonWithSummary
                        title="Название баллов сообщества"
                        summary={[currencyNames[1]]}
                    >
                        {true && (
                            <div className="chateditor-currencynames">
                                <div
                                    className="chateditor-input"
                                    onClick={() => setExpanded(true as any)}
                                >
                                    <input
                                        placeholder="тугрик"
                                        {...etv(
                                            currencyNames[1],
                                            setCurrencyNames(1)
                                        )}
                                    />
                                    {currencyNames[1] && (
                                        <div className="chateditor-tip">
                                            один/одна {currencyNames[1]}
                                        </div>
                                    )}
                                </div>
                                {expanded && (
                                    <div className="chateditor-input">
                                        <input
                                            placeholder="тугрика"
                                            {...etv(
                                                currencyNames[2],
                                                setCurrencyNames(2)
                                            )}
                                        />
                                        {currencyNames[2] && (
                                            <div className="chateditor-tip">
                                                два/две {currencyNames[2]}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {expanded && (
                                    <div className="chateditor-input">
                                        <input
                                            placeholder="тугриков"
                                            {...etv(
                                                currencyNames[5],
                                                setCurrencyNames(5)
                                            )}
                                        />
                                        {currencyNames[5] && (
                                            <div className="chateditor-tip">
                                                пять {currencyNames[5]}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <button
                                    className="chateditor-button_save"
                                    {...{ loading }}
                                    onClick={!loading && save}
                                >
                                    Сохранить
                                </button>
                            </div>
                        )}
                    </AccordeonWithSummary>
                    <AccordeonWithSummary
                        title="Символ баллов сообщества"
                        summary={[
                            <img className="currency-icon" src={icon}></img>,
                        ]}
                    >
                        <IconPicker
                            icon={icon}
                            cta="Выберите символ для баллов сообщества"
                            setIcon={(svgUrl) => {
                                setIcon(svgUrl);
                                setCanSend(false);
                            }}
                        />
                        {!canSend && (
                            <button
                                className="chateditor-button_save"
                                {...{ loading }}
                                onClick={!loading && save}
                            >
                                Сохранить символ
                            </button>
                        )}
                    </AccordeonWithSummary>
                    <AccordeonWithSummary
                        title="Ценности сообщества"
                        summary={spaces.map((s, i) => "#" + s.tagRus)}
                    >
                        <div className="chateditor-tags">
                            {spaces.map((s, i) => {
                                return (
                                    <div key={i} className="spaceeditor">
                                        <div className="spaceeditor-caption">
                                            тэг для отслеживания в чате
                                        </div>
                                        <div className="spaceeditor-input">
                                            <div className="input-wrapper">
                                                <span className="hastag">
                                                    #
                                                </span>
                                                <input
                                                    placeholder="введите название тэга"
                                                    {...etv(
                                                        s.tagRus ?? "",
                                                        setVal(i, "tagRus")
                                                    )}
                                                />
                                            </div>

                                            <div className="spaceeditor-tip tip">
                                                любое сообщение с этим тегом в
                                                чате сообщества автоматически
                                                попадет на сайт
                                            </div>
                                        </div>
                                        <div className="spaceeditor-input">
                                            <textarea
                                                placeholder="описание ценности"
                                                {...etv(
                                                    s.description ?? "",
                                                    setVal(i, "description")
                                                )}
                                            />
                                        </div>

                                        {!s.deleted && (
                                            <button
                                                className="spaceeditor-button_delete"
                                                onClick={del(i)}
                                            >
                                                удалить
                                            </button>
                                        )}
                                        {s.deleted && <span>удалено</span>}
                                    </div>
                                );
                            })}
                            <button
                                className="chateditor-button_new"
                                onClick={addnew}
                            >
                                + Добавить ценность
                            </button>
                        </div>
                        <div className="chateditor-actions">
                            {error && (
                                <div className="chateditor-error">{error}</div>
                            )}
                            {!canSend && (
                                <button
                                    className="chateditor-button_save"
                                    {...{ loading }}
                                    onClick={!loading && save}
                                >
                                    Завершить редактирование
                                </button>
                            )}
                            {canSend && (
                                <div>
                                    <div>
                                        Информация обновлена. Вышлите памятку,
                                        чтобы разместить ее в сообществе
                                    </div>
                                    <button
                                        className="chateditor-button_save"
                                        {...{ loading }}
                                        onClick={() =>
                                            !loading && sendMemo(true)
                                        }
                                    >
                                        Выслать памятку себе
                                    </button>
                                    <button
                                        className="chateditor-button_save"
                                        {...{ loading }}
                                        onClick={() =>
                                            !loading && sendMemo(false)
                                        }
                                    >
                                        Выслать памятку в сообщество
                                    </button>
                                </div>
                            )}
                            {loading && <Spinner />}
                            <DivFade text={info} className="chateditor-info" />
                        </div>
                    </AccordeonWithSummary>
                </div>
            )}
        </div>
    );
};

const ManagePage = () => {
    const router = useRouter();
    const [refreshChatId, setRefreshChatId] = useState(undefined);
    useEffect(() => {
        setRefreshChatId(document.location.search.split("refreshChatId=")?.[1]);
    }, []);
    const [chats] = swr(
        () =>
            refreshChatId
                ? "/api/rest/getmanagedchats?refreshChatId=" + refreshChatId
                : "/api/rest/getmanagedchats",
        [],
        { key: "chats" }
    );
    const [user] = swr("/api/rest/getme", { init: true });

    useEffect(() => {
        if (!user.tgUserId && !user.init) {
            router.push("/mt/login?manage");
        }
    }, [user]);

    const [userdata] = swr(
        () =>
            "/api/userdata?action=userdataGetByTelegramId&telegramUserId=" +
            user.tgUserId,
        0,
        { key: "userdata" }
    );
    const [selectedChatIdx, setSelectedChatIdx] = useState(-1);

    useEffect(() => {
        if (chats?.length == 1) setSelectedChatIdx(0);
    }, [chats]);

    if (!user.tgUserId) return null;
    return (
        <Page className="pagemanage">
            <div className="flex justify-end mb-2">
                <ThemeToggle />
            </div>
            <HeaderAvatarBalance
                balance1={undefined}
                balance2={undefined}
                avatarUrl={telegramGetAvatarLink(user?.tgUserId)}
                onAvatarUrlNotFound={() =>
                    telegramGetAvatarLinkUpd(user?.tgUserId)
                }
                onClick={() => {
                    router.push("/mt/balance");
                }}
            >
                <MenuBreadcrumbs>
                    <div>Настройки сообществ</div>
                </MenuBreadcrumbs>
                <div>
                    Здесь отображаются чаты, в которых Вы администратор и
                    подключен бот
                </div>
            </HeaderAvatarBalance>
            <div className="mar-40"></div>
            {chats.map((chat, i) => {
                return (
                    <Chat
                        key={i}
                        {...chat}
                        opened={selectedChatIdx === i}
                        onClick={() => setSelectedChatIdx(i)}
                    />
                );
            })}
        </Page>
    );
};

export default ManagePage;
