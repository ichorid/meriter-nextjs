'use client';

import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useWallets } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import TgEmbed from '@shared/components/tgembed';
import { useState, use } from "react";
import { etv } from '@shared/lib/input-utils';
import { useTranslations } from 'next-intl';

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
    const t = useTranslations('pages');

    const rate = 1;

    const [amount, setAmount] = useState(0);
    const [directionAdd, setDirectionAdd] = useState<boolean | undefined>(undefined);
    const disabled = !amount;
    
    // Note: Submit functionality removed - endpoint /api/d/meriter/withdraw doesn't exist
    // This feature is currently non-functional

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
                    {t('commbalance.available', { amount: sum })}{" "}
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
                    <div className="publication-withdraw-merits">
                        <div className="publication-withdraw">
                            {directionAdd ? t('commbalance.add') : t('commbalance.remove')} {t('commbalance.communityPoints')}:{" "}
                            <input
                                {...etv(String(amount), (value) => setAmount(Number(value)))}
                                min={0}
                                max={sum}
                            />
                            <button disabled>
                                {t('commbalance.ok')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const verb = (w: { amount: number; currencyNames: string[] }) => {
    const { amount, currencyNames } = w;
    if (amount === 0) return `0 ${currencyNames[5]}`;
    else if (amount === 1) return `1 ${currencyNames[1]}`;
    else if (amount === 2 || amount === 3 || amount === 4)
        return `${amount} ${currencyNames[2]}`;
    else return `${amount} ${currencyNames[5]}`;
};

const PageCommunityBalance = ({ searchParams }: { searchParams: Promise<{ chatId?: string }> }) => {
    const t = useTranslations('pages');
    const resolvedSearchParams = use(searchParams);
    const chatId = resolvedSearchParams?.chatId;
    const { user } = useAuth();
    const { data: wallets = [] } = useWallets();
    const activeCommentHook = useState<string | null>(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
    
    if (!chatId) return null;

    // Note: This page is non-functional - endpoints /api/d/meriter/* don't exist
    const [myPublications] = useState([]);
    const [rate] = useState(0);

    return (
        <AdaptiveLayout 
            className="balance"
            communityId={chatId}
            activeCommentHook={activeCommentHook}
            activeSlider={activeSlider}
            setActiveSlider={setActiveSlider}
            activeWithdrawPost={activeWithdrawPost}
            setActiveWithdrawPost={setActiveWithdrawPost}
            wallets={Array.isArray(wallets) ? wallets : []}
            myId={user?.id}
        >
            <div className="balance-available">
                <div className="heading">{t('commbalance.availableBalance')}</div>
                {/* Note: This page is non-functional - wallet structure doesn't match verb function */}
                {wallets.map((w: any, i: number) => (
                    <div key={i}>{w.balance || 0} {w.communityId || 'points'}</div>
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
                        {myPublications.map((p: any, i: number) => (
                            <PublicationMy key={i} {...p} />
                        ))}
                    </div>
                </div>
            </div>
        </AdaptiveLayout>
    );
};

export default PageCommunityBalance;
