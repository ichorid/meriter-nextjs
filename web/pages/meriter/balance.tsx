import Page from "projects/meriter/components/page";
import { swr } from "utils/swr";
import { useEffect, useState } from "react";
import { HeaderAvatarBalance } from "frontend/header-avatar-balance";
import Router from "next/router";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from "bots/telegram/telegramapi";
import { MenuBreadcrumbs } from "frontend/menu-breadcrumbs";
import { classList } from "utils/classList";
import { TransactionToMe } from "../../components/meriter/transaction-to-me";
import { WalletCommunity } from "../../components/wallet-community";
import { ContentMY } from "../../components/content-my";
import { UpdatesFrequency } from "../../components/updates-frequency";

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

const PageBalance = () => {
    const balance = [];
    const [myPublications, updatePublications] = swr(
        "/api/rest/publicationsinf?my&skip=0&limit=100",
        [],
        {
            key: "publications",
            revalidateOnFocus: false,
        }
    );
    const [myComments, updateComments] = swr(
        "/api/rest/transaction?my&positive=true",
        [],
        {
            key: "transactions",
            revalidateOnFocus: false,
        }
    );
    const [myUpdates, updateUpdates] = swr(
        "/api/rest/transaction?updates=true",
        [],
        {
            key: "transactions",
            revalidateOnFocus: false,
        }
    );
    const [wallets, updateWallets] = swr("/api/rest/wallet", [], {
        key: "wallets",
    });
    const [user] = swr("/api/rest/getme", {});
    const [tab, setTab] = useState("updates");

    const updateAll = () => {
        //updatePublications({ publications: myPublications })
        //updateWallets({ wallets: wallets })
        document.location.reload();
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

    const [userdata] = swr(
        () =>
            "/api/rest/userdata?action=userdataGetByTelegramId&telegramUserId=" +
            user.tgUserId,
        0,
        { key: "userdata" }
    );
    const tgAuthorId = user?.tgUserId;

    return (
        <Page className="balance">
            <HeaderAvatarBalance
                balance1={{ icon: "", amount: balance }}
                balance2={undefined}
                avatarUrl={
                    user?.authorPhotoUrl ?? telegramGetAvatarLink(tgAuthorId)
                }
                onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId)}
                onClick={() => {
                    Router.push("/mt/balance");
                }}
            >
                <MenuBreadcrumbs>
                    <div>Баланс</div>
                </MenuBreadcrumbs>

                <div>
                    <div className="tip">
                        переводите баллы из публикаций и комментариев на
                        доступный баланс, чтобы пользоваться ими
                    </div>
                    <div className="tip">
                        переводите доступный баланс на публикации и комментарии,
                        чтобы их видело больше людей{" "}
                    </div>
                </div>
            </HeaderAvatarBalance>
            <div className="balance-available">
                {false && <div className="heading">Доступный баланс</div>}
                {wallets.map((w) => (
                    <WalletCommunity key={w._id} {...w} />
                ))}
            </div>
            <div className="balance-inpublications">
                <div className="switch">
                    <span
                        style={{ display: "inline-block" }}
                        className={classList(
                            "heading",
                            tab === "publications" ? "accent" : undefined
                        )}
                        onClick={() => {
                            setTab("publications");
                        }}
                    >
                        Мои публикации
                    </span>
                    <span
                        style={{ display: "inline-block" }}
                        className={classList(
                            "heading",
                            tab === "comments" ? "accent" : undefined
                        )}
                        onClick={() => {
                            setTab("comments");
                        }}
                    >
                        Мои комментарии
                    </span>
                    <span
                        style={{ display: "inline-block" }}
                        className={classList(
                            "heading",
                            tab === "updates" ? "accent" : undefined
                        )}
                        onClick={() => {
                            setTab("updates");
                        }}
                    >
                        Обновления
                    </span>
                </div>
                {tab === "updates" && (
                    <div className="balance-inpublications-list">
                        <UpdatesFrequency />
                        <div className="balance-inpublications-filters"></div>
                        <div className="balance-inpublications-publications">
                            {myUpdates
                                .filter((p) => p.comment)
                                .map((p: any, i) => (
                                    <TransactionToMe key={i} transaction={p} />
                                ))}
                        </div>
                    </div>
                )}
                {tab === "publications" && (
                    <div className="balance-inpublications-list">
                        <div className="balance-inpublications-filters"></div>
                        <div className="balance-inpublications-publications">
                            {myPublications &&
                                myPublications
                                    .filter((p) => p.messageText)
                                    .map((p, i) => (
                                        <ContentMY
                                            key={i}
                                            {...p}
                                            updateAll={updateAll}
                                            wallets={wallets}
                                        />
                                    ))}
                        </div>
                    </div>
                )}
                {tab === "comments" && (
                    <div className="balance-inpublications-list">
                        <div className="balance-inpublications-filters"></div>
                        <div className="balance-inpublications-publications">
                            {myComments
                                .filter((p) => p.comment)
                                .map((p, i) => (
                                    <ContentMY
                                        key={i}
                                        {...p}
                                        transactionId={p._id}
                                        updateAll={updateAll}
                                        wallets={wallets}
                                    />
                                ))}
                        </div>
                    </div>
                )}
            </div>
        </Page>
    );
};

export default PageBalance;
