'use client';

import { GLOBAL_FEED_TG_CHAT_ID } from "@config/meriter";
import { useEffect, useState } from "react";
import { swr } from "@lib/swr";
import Axios from "axios";
import { Spinner } from "@shared/components/misc";
import { FormWithdraw } from "@features/wallet/components/form-withdraw";
import { CommentMy } from "@features/comments/components/comment-my";
import { PublicationMy } from "./publication-my";

export const ContentMY = (props) => {
    const {
        slug: publicationSlug,
        tgChatName,
        tgChatId,
        tgMessageId,
        plus,
        minus,
        sum,
        currency,
        inMerits,
        messageText,
        authorPhotoUrl,
        tgAuthorName,
        ts,
        keyword,
        updateAll,
        transactionId,
        wallets,
        currencyOfCommunityTgChatId,
        fromTgChatId,
    } = props;
    const curr = currencyOfCommunityTgChatId || fromTgChatId;
    const currentBalance =
        (wallets &&
            wallets.find((w) => w.currencyOfCommunityTgChatId == curr)
                ?.amount) ||
        0;
    const isMerit = tgChatId === GLOBAL_FEED_TG_CHAT_ID;
    const [showselector, setShowselector] = useState(false);
    useEffect(() => {
        if (document.location.search.match("show")) setShowselector(true);
    }, []);

    const [rate] = swr(
        () => !isMerit && "/api/rest/rate?fromCurrency=" + tgChatId,
        0,
        { key: "rate", revalidateOnFocus: false }
    );

    const [amount, setAmount] = useState(0);
    const [comment, setComment] = useState("");
    const [amountInMerits, setAmountInMerits] = useState(0);
    const [withdrawMerits, setWithdrawMerits] = useState(isMerit);
    const [directionAdd, setDirectionAdd] = useState(undefined);
    const [loading, setLoading] = useState(false);
    const doWhat = directionAdd ? "Добавить" : "Снять";
    const disabled = withdrawMerits ? !amountInMerits : !amount;
    const submit = () => {
        setLoading(true);
        Axios.post("/api/rest/withdraw", {
            publicationSlug,
            transactionId,
            amount: withdrawMerits ? amountInMerits : amount,
            currency: withdrawMerits ? "merit" : currency,
            directionAdd,
            withdrawMerits,
            comment,
            amountInternal: withdrawMerits
                ? rate > 0
                    ? amountInMerits / rate
                    : 0
                : amount,
        })
            .then((d) => d.data)
            .then((d) => {
                setLoading(false);
                updateAll();
            });
        setAmount(0);
        setAmountInMerits(0);
    };
    const meritsAmount =
        Math.floor(10 * (withdrawMerits ? rate * sum : sum)) / 10;

    const maxWithdrawAmount =
        Math.floor(10 * (withdrawMerits ? rate * sum : sum)) / 10;

    const maxTopUpAmount =
        Math.floor(
            10 * (withdrawMerits ? rate * currentBalance : currentBalance)
        ) / 10;

    const params = {
        setDirectionAdd,
        meritsAmount,
        showselector,
        withdrawMerits,
        transactionId,

        setWithdrawMerits,
    };

    return (
        <div className="publication-my">
            {publicationSlug && <PublicationMy {...props} {...params} />}
            {!publicationSlug && <CommentMy {...props} {...params} />}

            {false && (
                <div className="publication-status">
                    <button
                        onClick={() => {
                            setDirectionAdd(false);
                            setAmount(0);
                        }}
                    >
                        Снять
                    </button>

                    <span className="sum">
                        Доступно {meritsAmount}{" "}
                        {inMerits && (
                            <img className="inline" src={"/merit.svg"} />
                        )}
                    </span>

                    <button
                        onClick={() => {
                            setDirectionAdd(true);
                            setAmount(0);
                        }}
                    >
                        Пополнить
                    </button>
                </div>
            )}
            {directionAdd !== undefined && (
                <div className="publication-withdraw">
                    {withdrawMerits &&
                        (loading ? (
                            <Spinner />
                        ) : (
                            <FormWithdraw
                                comment={comment}
                                setComment={setComment}
                                amount={amount}
                                setAmount={setAmount}
                                maxWithdrawAmount={maxWithdrawAmount}
                                maxTopUpAmount={maxTopUpAmount}
                                isWithdrawal={!directionAdd}
                                onSubmit={() => !disabled && submit()}
                            >
                                <div>
                                    {doWhat} меритов: {amount}
                                </div>
                            </FormWithdraw>
                        ))}

                    {!withdrawMerits &&
                        (loading ? (
                            <Spinner />
                        ) : (
                            <FormWithdraw
                                comment={comment}
                                setComment={setComment}
                                amount={amount}
                                setAmount={setAmount}
                                maxWithdrawAmount={maxWithdrawAmount}
                                maxTopUpAmount={maxTopUpAmount}
                                isWithdrawal={!directionAdd}
                                onSubmit={() => !disabled && submit()}
                            >
                                <div>
                                    {doWhat} баллов сообщества: {amount}
                                </div>
                            </FormWithdraw>
                        ))}
                </div>
            )}
        </div>
    );
};
