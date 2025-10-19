'use client';

import Page from '@shared/components/page';
import { swr } from '@lib/swr';
import { useEffect, useState } from "react";
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
import { ContentMY } from "@features/feed/components/content-my";
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
    const [wallets, updateWallets] = swr("/api/rest/wallet", [], {
        key: "wallets",
    });
    const [user] = swr("/api/rest/getme", {});
    const [tab, setTab] = useState("updates");
    const [showPollCreate, setShowPollCreate] = useState(false);

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
            user.tgUserId
                ? `/api/rest/users/telegram/${user.tgUserId}/profile`
                : null,
        0,
        { key: "userdata" }
    );
    const tgAuthorId = user?.tgUserId;

    useEffect(() => {
        if (!user?.tgUserId && !user.init) {
            router.push("/meriter/login");
        }
    }, [user, user?.init, router]);

    if (!user.token) {
        return null; // Loading or not authenticated
    }

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
                <MenuBreadcrumbs>
                    <div>Главная</div>
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
                {wallets && wallets.map((w) => (
                    <WalletCommunity key={w._id} {...w} />
                ))}
            </div>
            <div className="balance-inpublications">
                <div className="tabs tabs-boxed mb-4">
                    <a
                        className={classList(
                            "tab",
                            tab === "publications" && "tab-active"
                        )}
                        onClick={() => {
                            setTab("publications");
                        }}
                    >
                        Мои публикации
                    </a>
                    <a
                        className={classList(
                            "tab",
                            tab === "comments" && "tab-active"
                        )}
                        onClick={() => {
                            setTab("comments");
                        }}
                    >
                        Мои комментарии
                    </a>
                    <a
                        className={classList(
                            "tab",
                            tab === "updates" && "tab-active"
                        )}
                        onClick={() => {
                            setTab("updates");
                        }}
                    >
                        Обновления
                    </a>
                </div>
                {tab === "updates" && (
                    <div className="balance-inpublications-list">
                        <div className="balance-inpublications-filters"></div>
                        <div className="balance-inpublications-publications">
                            {myUpdates &&
                                myUpdates
                                    .filter((p) => p.comment)
                                    .map((p: any, i) => (
                                        <TransactionToMe key={i} transaction={p} />
                                    ))}
                        </div>
                    </div>
                )}
                {tab === "publications" && (
                    <div className="balance-inpublications-list">
                        <div className="balance-inpublications-filters">
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
                                    marginBottom: "15px"
                                }}
                            >
                                📊 Создать опрос
                            </button>
                        </div>
                        <div className="balance-inpublications-publications">
                            {myPublications &&
                                myPublications
                                    .filter((p) => p.messageText || p.type === 'poll')
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
                            {myComments &&
                                myComments
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

