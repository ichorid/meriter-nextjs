import Page from "projects/meriter/components/page";
import { swr } from "utils/swr";
import TgEmbed from "projects/meriter/components/tgembed";
import { useState } from "react";
import { etv } from "utils/input";
import Axios from "axios";
import { Spinner } from "projects/meriter/components/misc";
import { MERITERRA_TG_CHAT_ID } from "projects/meriter/config";

interface iCommunityProps {
    name: string;
    description: string;
    balance: number;
    capitalization: number;
}
const PublicationMy = ({
    slug: publicationSlug,
    tgChatName,
    tgChatId,
    fromTgChatId,
    tgMessageId,
    plus,
    minus,
    sum,
    currency,
    inMerits,
}: any) => {
    const isMerit = tgChatId === MERITERRA_TG_CHAT_ID;

    const rate = 1;

    const [amount, setAmount] = useState(0);
    const [amountInMerits, setAmountInMerits] = useState(0);
    const [withdrawMerits, setWithdrawMerits] = useState(true);

    const [directionAdd, setDirectionAdd] = useState(undefined);
    const [loading, setLoading] = useState(false);
    const doWhat = directionAdd ? "Добавить" : "Снять";
    const disabled = withdrawMerits ? !amountInMerits : !amount;
    const submit = () => {
        setLoading(true);
        Axios.post("/api/d/meriter/withdraw", {
            comm: fromTgChatId,
            publicationSlug,
            amount: withdrawMerits ? amountInMerits : amount,
            currency: withdrawMerits ? "merit" : currency,
            directionAdd,
        })
            .then((d) => d.data)
            .then((d) => {
                setLoading(false);
            });
        setAmount(0);
        setAmountInMerits(0);
    };

    return (
        <div className="publication-my">
            <TgEmbed src={`${tgChatName}/${tgMessageId}`} />
            <div className="publication-status">
                <button
                    onClick={() => {
                        setDirectionAdd(false);
                    }}
                >
                    Снять
                </button>

                <span className="sum">
                    Доступно {withdrawMerits ? rate * sum : sum}{" "}
                    {inMerits && <img className="inline" src={"/merit.svg"} />}
                </span>

                <button
                    onClick={() => {
                        setDirectionAdd(true);
                    }}
                >
                    Пополнить
                </button>
            </div>

            {directionAdd !== undefined && (
                <div className="publication-withdraw">
                    {withdrawMerits && (
                        <div className="publication-withdraw-merits">
                            <div className="publication-withdraw">
                                {doWhat} меритов:{" "}
                                <input
                                    {...etv(amountInMerits, setAmountInMerits)}
                                    min={0}
                                    max={sum * rate}
                                />
                                {loading ? (
                                    <Spinner />
                                ) : (
                                    <button
                                        disabled={disabled}
                                        onClick={() => !disabled && submit()}
                                    >
                                        ок
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    {!withdrawMerits && (
                        <div className="publication-withdraw-merits">
                            <div className="publication-withdraw">
                                {doWhat} баллов сообщества:{" "}
                                <input
                                    {...etv(amount, setAmount)}
                                    min={0}
                                    max={sum}
                                />
                                {loading ? (
                                    <Spinner />
                                ) : (
                                    <button
                                        disabled={disabled}
                                        onClick={() => !disabled && submit()}
                                    >
                                        ок
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const verb = (w) => {
    const { amount, currencyNames } = w;
    if (amount === 0) return `0 ${currencyNames[5]}`;
    else if (amount === 1) return `1 ${currencyNames[1]}`;
    else if (amount === 2 || amount === 3 || amount === 4)
        return `${amount} ${currencyNames[2]}`;
    else return `${amount} ${currencyNames[5]}`;
};
export async function getServerSideProps(ctx) {
    const { chatId } = ctx.query;
    return { props: { chatId } };
}

const PageCommunityBalance = ({ chatId }) => {
    if (!chatId) return null;

    const [myPublications] = swr(
        "/api/d/meriter/publications?comm=" + chatId,
        [],
        { key: "publications", revalidateOnFocus: false }
    );
    const [wallets] = swr("/api/d/meriter/wallet?comm=" + chatId, [], {
        key: "wallets",
    });
    const [rate, updRate] = swr(
        "/api/d/meriter/rate?fromCurrency=" + chatId,
        0,
        { key: "rate", revalidateOnFocus: false }
    );

    return (
        <Page className="balance">
            <div className="balance-available">
                <div className="heading">Доступный баланс сообщества</div>
                {wallets.map((w) => (
                    <div>{verb(w)}</div>
                ))}

                <div className="t">
                    Обменный курс: {Math.round(rate * 1000) / 1000}
                </div>
            </div>
            <div className="balance-inpublications">
                <div className="heading">
                    Накоплено сообществом в публикациях
                </div>
                <div className="tip">
                    переводите баллы из публикаций на доступный баланс, чтобы
                    пользоваться ими
                </div>
                <div className="tip">
                    переводите доступный баланс на публикации, чтобы их видело
                    больше людей{" "}
                </div>
                <div className="balance-inpublications-list">
                    <div className="balance-inpublications-filters"></div>
                    <div className="balance-inpublications-publications">
                        {myPublications.map((p, i) => (
                            <PublicationMy key={i} {...p} updRate={updRate} />
                        ))}
                    </div>
                </div>
            </div>
        </Page>
    );
};

export default PageCommunityBalance;
