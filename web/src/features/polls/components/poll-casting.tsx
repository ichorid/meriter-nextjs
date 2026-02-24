'use client';

import { useState, useMemo } from "react";
import { IPollData, IPollCast, IPollUserCastSummary } from "../types";
import { useTranslations } from 'next-intl';
import { useCastPoll } from '@/hooks/api/usePolls';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';
import { usePollTimeRemaining } from '../hooks/usePollTimeRemaining';
import { usePollAmountValidation } from '../hooks/usePollAmountValidation';
import { useToastStore } from '@/shared/stores/toast.store';
import { Loader2 } from 'lucide-react';
import { useCommunityQuotas } from '@/hooks/api/useCommunityQuota';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useCommunity } from '@/hooks/api/useCommunities';
import { formatMerits } from '@/lib/utils/currency';

interface IPollCastingProps {
    pollData: IPollData;
    pollId: string;
    userCast?: IPollCast;
    userCastSummary?: IPollUserCastSummary;
    balance: number;
    onCastSuccess?: () => void;
    communityId?: string;
    /** Remove wrapper styling for inline display in publication cards */
    noWrapper?: boolean;
}

export const PollCasting = ({
    pollData,
    pollId,
    userCast,
    userCastSummary,
    balance,
    onCastSuccess,
    communityId,
    noWrapper = false,
}: IPollCastingProps) => {
    const t = useTranslations('polls');
    const addToast = useToastStore((state) => state.addToast);
    const { user } = useAuth();
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
    const [amountInputValue, setAmountInputValue] = useState<string>("1");
    const [castAmount, setCastAmount] = useState<number>(1);
    const [amountValidationError, setAmountValidationError] = useState<string | null>(null);
    const [error, setError] = useState<string>("");

    const castPollMutation = useCastPoll(communityId);

    // Get quota data
    const { quotasMap } = useCommunityQuotas(communityId ? [communityId] : []);
    const quotaData = communityId ? quotasMap.get(communityId) : null;
    const quotaRemaining = quotaData?.remainingToday ?? 0;

    // Get user role to check if quota can be used
    const { data: userRoles = [] } = useUserRoles(user?.id || '');
    const { data: community } = useCommunity(communityId || '');

    // Check if user can use quota (participants/leads/superadmin)
    const canUseQuota = useMemo(() => {
        if (!user?.id || !communityId || !community) return false;
        if (user.globalRole === 'superadmin') return true;
        if (community.typeTag === 'future-vision') return false; // Future vision doesn't use quota
        const role = userRoles.find(r => r.communityId === communityId);
        return role && ['participant', 'lead', 'superadmin'].includes(role.role);
    }, [user?.id, user?.globalRole, userRoles, communityId, community]);

    // Calculate max amount (quota + wallet)
    const maxAmount = canUseQuota ? quotaRemaining + balance : balance;

    const now = new Date();
    const expiresAt = new Date(pollData.expiresAt);
    const isExpired = now > expiresAt;
    const isCasting = castPollMutation.isPending;

    const timeRemaining = usePollTimeRemaining({ expiresAt: pollData.expiresAt });
    const { validateAmount } = usePollAmountValidation({ balance: maxAmount });

    const handleCastPoll = async () => {
        if (!selectedOptionId) {
            const message = t('selectOption');
            setError(message);
            addToast(message, 'warning');
            return;
        }

        // Validate amount explicitly one more time before submission (double-check)
        const validation = validateAmount(amountInputValue);
        if (!validation.isValid || validation.numValue === null) {
            setAmountValidationError(validation.error);
            if (validation.error) {
                addToast(validation.error, 'error');
            }
            return;
        }

        // Double-check max amount (UX validation should prevent this, but safety check)
        if (validation.numValue > maxAmount) {
            const message = t('amountInsufficient', { balance: maxAmount });
            setAmountValidationError(message);
            addToast(message, 'error');
            return;
        }

        // Calculate quota and wallet breakdown
        let quotaAmount = 0;
        let walletAmount = 0;

        if (canUseQuota && quotaRemaining > 0) {
            // Use quota first, then wallet
            quotaAmount = Math.min(validation.numValue, quotaRemaining);
            walletAmount = Math.max(0, validation.numValue - quotaRemaining);
        } else {
            // No quota available, use wallet only
            walletAmount = validation.numValue;
        }

        // Clear any previous errors
        setError("");
        setAmountValidationError(null);

        try {
            await castPollMutation.mutateAsync({
                pollId: pollId,
                data: {
                    optionId: selectedOptionId,
                    quotaAmount,
                    walletAmount,
                },
            });

            // Reset form explicitly
            setCastAmount(1);
            setAmountInputValue("1");
            setSelectedOptionId(null);

            addToast(t('castSuccess'), 'success');
            onCastSuccess && onCastSuccess();
        } catch (err: unknown) {
            const errorMessage = extractErrorMessage(err, t('castError'));
            setError(errorMessage);
            addToast(errorMessage, 'error');
        }
    };

    const getOptionPercentage = (votes: number) => {
        const totalVotes = pollData.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
        if (totalVotes === 0) return 0;
        return (votes / totalVotes) * 100;
    };
    const showDescription = pollData.description && pollData.description.trim() !== pollData.title?.trim();

    const content = (
        <>
            <div className="mb-4 animate-in fade-in duration-300">
                <h3 className="text-lg font-semibold text-base-content mb-1">{pollData.title}</h3>
                {showDescription && (
                    <p className="text-sm text-base-content/70 mb-3">{pollData.description}</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`badge ${isExpired ? "badge-error" : "badge-success"}`}>
                        {isExpired ? t('finished') : t('active')}
                    </span>
                    <span className="badge badge-ghost">
                        {isExpired ? t('pollFinished') : `${t('timeRemaining')}: ${timeRemaining}`}
                    </span>
                    <span className="badge badge-ghost">
                        {t('totalCasts')}: {pollData.totalCasts}
                    </span>
                </div>
            </div>

            <div className="rounded-xl border border-base-300 bg-base-200/50 p-3 mb-4 space-y-3">
                {pollData.options.map((option) => {
                    const percentage = getOptionPercentage(option.votes);
                    const isSelected = selectedOptionId === option.id;
                    const userCastAmount = userCastSummary?.byOption?.[option.id] || 0;

                    return (
                        <div
                            key={`poll-option-${option.id}`}
                            className={`rounded-lg p-2.5 transition-colors ${isSelected ? "ring-2 ring-primary ring-inset bg-primary/5" : "bg-base-100/80"}
                                ${userCastAmount > 0 ? "bg-primary/10" : ""} ${isExpired ? "opacity-70" : "hover:bg-base-100"}`}
                        >
                            <div className="flex justify-between items-center gap-2 mb-1.5">
                                <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                    <input
                                        type="radio"
                                        name="poll-option"
                                        value={option.id}
                                        checked={isSelected}
                                        disabled={isExpired}
                                        className="radio radio-primary radio-sm shrink-0"
                                        onChange={(e) => {
                                            if (!isExpired) {
                                                setSelectedOptionId(e.target.value);
                                                setError("");
                                                setAmountValidationError(null);
                                            }
                                        }}
                                    />
                                    <span className="font-medium text-sm truncate">{option.text}</span>
                                </label>
                                {userCastAmount > 0 && (
                                    <span className="badge badge-primary badge-sm shrink-0">
                                        {t('you')}: {userCastAmount}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 min-w-0 h-1.5 bg-base-300 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-secondary rounded-full transition-all duration-300"
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                                <span className="text-xs text-base-content/60 shrink-0">
                                    {option.votes} {t('merits')} · {percentage.toFixed(0)}% · {t('castersWithCount', { count: option.casterCount ?? 0 })}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {!isExpired && (
                <div className="rounded-xl border border-base-300 bg-base-200/50 p-4 space-y-3">
                    <div>
                        <label htmlFor="cast-amount" className="block text-sm font-medium text-base-content mb-1.5">
                            {t('amountLabel')}
                        </label>
                        <input
                            id="cast-amount"
                            type="text"
                            inputMode="numeric"
                            value={amountInputValue}
                            onChange={(e) => {
                                const inputValue = e.target.value;
                                setAmountInputValue(inputValue);
                                const validation = validateAmount(inputValue);
                                if (validation.isValid && validation.numValue !== null) {
                                    setAmountValidationError(null);
                                    setCastAmount(validation.numValue);
                                } else {
                                    setAmountValidationError(validation.error);
                                }
                            }}
                            onBlur={(e) => {
                                const inputValue = e.target.value;
                                const validation = validateAmount(inputValue);
                                if (validation.isValid && validation.numValue !== null) {
                                    setAmountValidationError(null);
                                    setCastAmount(validation.numValue);
                                    setAmountInputValue(validation.numValue.toString());
                                } else {
                                    setAmountValidationError(validation.error);
                                    if (castAmount < 1) {
                                        setCastAmount(1);
                                        setAmountInputValue("1");
                                    }
                                }
                            }}
                            disabled={isCasting}
                            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        />
                        <p className="mt-1.5 text-xs text-base-content/60">
                            {t('available')}: <span className="font-semibold">{formatMerits(quotaRemaining + balance)}</span> {t('merits')}
                            {canUseQuota && community?.meritSettings?.quotaEnabled !== false && (
                                <>
                                    , {t('fromWhich')} {quotaRemaining} – {t('quota')}
                                    {balance > 0 && <> {t('and')} <span className="font-semibold">{formatMerits(balance)}</span> – {t('merits')}</>}
                                </>
                            )}
                        </p>
                    </div>
                    {amountValidationError && (
                        <p className="text-xs text-error">{amountValidationError}</p>
                    )}
                    {maxAmount === 0 && (
                        <p className="text-xs text-error">{t('insufficientPoints')}</p>
                    )}
                    <button
                        type="button"
                        onClick={handleCastPoll}
                        disabled={isCasting || !selectedOptionId || amountValidationError !== null || maxAmount === 0}
                        className={`w-full h-10 px-4 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                            isCasting || !selectedOptionId || amountValidationError !== null || maxAmount === 0
                                ? 'bg-base-content/10 text-base-content/40 cursor-not-allowed'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                        }`}
                    >
                        {isCasting && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                        {isCasting ? t('casting') : t('castPoll')}
                    </button>
                </div>
            )}

            {userCastSummary && userCastSummary.castCount > 0 && (
                <div className="text-sm text-info p-3 bg-info/10 rounded-xl">
                    <span>{t('youCastSummary', { count: userCastSummary.castCount, amount: userCastSummary.totalAmount })}</span>
                </div>
            )}

            {isExpired && (
                <div className="text-sm text-warning p-3 bg-warning/10 rounded-xl">
                    <span>{t('pollExpired')}</span>
                </div>
            )}
        </>
    );

    // Return with or without wrapper based on noWrapper prop
    if (noWrapper) {
        return content;
    }

    return (
        <div className="p-5 bg-accent/5 border-l-4 border-accent transition-all duration-300 ease-in-out rounded-xl">
            {content}
        </div>
    );
};

