'use client';

import Page from '@shared/components/page';
import { swr } from '@lib/swr';
import TgEmbed from '@shared/components/tgembed';
import { useState, use } from "react";
import { etv } from '@shared/lib/input-utils';
import Axios from "axios";
import { Spinner } from '@shared/components/misc';
import { GLOBAL_FEED_TG_CHAT_ID } from '@config/meriter';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation('pages');
    const isMerit = tgChatId === GLOBAL_FEED_TG_CHAT_ID;

    const rate = 1;

    const [amount, setAmount] = useState(0);
    const [amountInMerits, setAmountInMerits] = useState(0);
    const [withdrawMerits, setWithdrawMerits] = useState(true);

    const [directionAdd, setDirectionAdd] = useState(undefined);
    const [loading, setLoading] = useState(false);
    const disabled = withdrawMerits ? !amountInMerits : !amount;
    const submit = () => {
        setLoading(true);
        // Dead API call - endpoint /api/d/meriter/withdraw doesn't exist
        // This feature is currently non-functional
        console.warn('Withdraw endpoint not implemented');
        setLoading(false);
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
                    {t('commbalance.withdraw')}
                </button>

                <span className="sum">
                    {t('commbalance.available', { amount: withdrawMerits ? rate * sum : sum })}{" "}
                    {inMerits && <img className="inline" src={"/merit.svg"} />}
                </span>

                <button
                    onClick={() => {
                        setDirectionAdd(true);
                    }}
                >
                    {t('commbalance.topup')}
                </button>
            </div>

            {directionAdd !== undefined && (
                <div className="publication-withdraw">
                    {withdrawMerits && (
                        <div className="publication-withdraw-merits">
                            <div className="publication-withdraw">
                                {directionAdd ? t('commbalance.add') : t('commbalance.remove')} {t('commbalance.merits')}:{" "}
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
                                        {t('commbalance.ok')}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    {!withdrawMerits && (
                        <div className="publication-withdraw-merits">
                            <div className="publication-withdraw">
                                {directionAdd ? t('commbalance.add') : t('commbalance.remove')} {t('commbalance.communityPoints')}:{" "}
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
                                        {t('commbalance.ok')}
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

const PageCommunityBalance = ({ searchParams }: { searchParams: Promise<{ chatId?: string }> }) => {
    const { t } = useTranslation('pages');
    const resolvedSearchParams = use(searchParams);
    const chatId = resolvedSearchParams?.chatId;
    if (!chatId) return null;

    // Dead API calls - these endpoints don't exist: /api/d/meriter/*
    // This page is currently non-functional
    const [myPublications] = useState([]);
    const [wallets] = useState([]);
    const [rate] = useState(0);
    const updRate = () => {}; // Placeholder for missing function

    return (
        <Page className="balance">
            <div className="balance-available">
                <div className="heading">{t('commbalance.availableBalance')}</div>
                {wallets.map((w) => (
                    <div>{verb(w)}</div>
                ))}

                <div className="t">
                    {t('commbalance.exchangeRate', { rate: Math.round(rate * 1000) / 1000 })}
                </div>
            </div>
            <div className="balance-inpublications">
                <div className="heading">
                    {t('commbalance.accumulatedInPublications')}
                </div>
                <div className="tip">
                    {t('commbalance.tip1')}
                </div>
                <div className="tip">
                    {t('commbalance.tip2')}
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
