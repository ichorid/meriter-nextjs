'use client';

import { useState } from "react";
import { IPollData, IPollCast, IPollUserCastSummary } from "../types";
import { useTranslations } from 'next-intl';
import { useCastPoll } from '@/hooks/api/usePolls';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';
import { usePollTimeRemaining } from '../hooks/usePollTimeRemaining';
import { usePollAmountValidation } from '../hooks/usePollAmountValidation';

interface IPollCastingProps {
    pollData: IPollData;
    pollId: string;
    userCast?: IPollCast;
    userCastSummary?: IPollUserCastSummary;
    balance: number;
    onCastSuccess?: () => void;
    communityId?: string;
    initiallyExpanded?: boolean;
}

export const PollCasting = ({
    pollData,
    pollId,
    userCast,
    userCastSummary,
    balance,
    onCastSuccess,
    communityId,
    initiallyExpanded = false,
}: IPollCastingProps) => {
    const t = useTranslations('polls');
    const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
    const [amountInputValue, setAmountInputValue] = useState<string>("1");
    const [castAmount, setCastAmount] = useState<number>(1);
    const [amountValidationError, setAmountValidationError] = useState<string | null>(null);
    const [error, setError] = useState<string>("");

    const castPollMutation = useCastPoll();

    const now = new Date();
    const expiresAt = new Date(pollData.expiresAt);
    const isExpired = now > expiresAt;
    const isCasting = castPollMutation.isPending;

    const timeRemaining = usePollTimeRemaining({ expiresAt: pollData.expiresAt });
    const { validateAmount } = usePollAmountValidation({ balance });

    const handleCastPoll = async () => {
        if (!selectedOptionId) {
            setError(t('selectOption'));
            return;
        }

        // Validate amount explicitly one more time before submission (double-check)
        const validation = validateAmount(amountInputValue);
        if (!validation.isValid || validation.numValue === null) {
            setAmountValidationError(validation.error);
            return;
        }

        // Double-check balance (UX validation should prevent this, but safety check)
        if (validation.numValue > balance) {
            setAmountValidationError(t('amountInsufficient', { balance }));
            return;
        }

        // Clear any previous errors
        setError("");
        setAmountValidationError(null);

        try {
            await castPollMutation.mutateAsync({
                id: pollId,
                data: {
                    optionId: selectedOptionId,
                    quotaAmount: 0, // Poll casts only use wallet
                    walletAmount: validation.numValue,
                },
                communityId,
            });

            // Reset form explicitly
            setCastAmount(1);
            setAmountInputValue("1");
            setSelectedOptionId(null);
            
            onCastSuccess && onCastSuccess();
        } catch (err: unknown) {
            const errorMessage = extractErrorMessage(err, t('castError'));
            setError(errorMessage);
        }
    };

    const getOptionPercentage = (votes: number) => {
        const totalVotes = pollData.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
        if (totalVotes === 0) return 0;
        return (votes / totalVotes) * 100;
    };

    // Collapsed view
    if (!isExpanded) {
        return (
            <div 
                className="p-4 bg-accent/5 border-l-4 border-accent cursor-pointer hover:bg-accent/10 transition-all duration-300 ease-in-out"
                onClick={() => setIsExpanded(true)}
            >
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">📊</span>
                            <h3 className="text-base font-bold">{pollData.title}</h3>
                        </div>
                        {pollData.description && (
                            <p className="text-sm opacity-70 line-clamp-2">{pollData.description}</p>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`badge badge-sm ${isExpired ? "badge-error" : "badge-success"}`}>
                        {isExpired ? t('finished') : t('active')}
                    </span>
                    <span className="badge badge-sm badge-ghost">
                        {isExpired ? t('pollFinished') : `${t('timeRemaining')} ${timeRemaining}`}
                    </span>
                    <span className="badge badge-sm badge-ghost">
                        🗳 {pollData.totalCasts} {t('casts')}
                    </span>
                    {userCastSummary && userCastSummary.castCount > 0 && (
                        <span className="badge badge-sm badge-primary">
                            {t('youCast')}
                        </span>
                    )}
                </div>
                <div className="text-xs opacity-50 mt-2 text-center">
                    {t('clickToView')}
                </div>
            </div>
        );
    }

    // Expanded view
    return (
        <div className="p-5 bg-accent/5 border-l-4 border-accent transition-all duration-300 ease-in-out">
            <div className="mb-5 animate-in fade-in duration-300">
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-lg">📊</span>
                        <h3 className="text-lg font-bold">{pollData.title}</h3>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(false);
                        }}
                        className="btn btn-ghost btn-sm btn-circle hover:bg-accent/20"
                        aria-label={t('collapseAria')}
                    >
                        ▲
                    </button>
                </div>
                {pollData.description && (
                    <p className="text-sm opacity-70 mb-3">{pollData.description}</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`badge ${isExpired ? "badge-error" : "badge-success"}`}>
                        {isExpired ? `🔴 ${t('finished')}` : `🟢 ${t('active')}`}
                    </span>
                    <span className="badge badge-ghost">
                        {isExpired ? t('pollFinished') : `${t('timeRemaining')}: ${timeRemaining}`}
                    </span>
                    <span className="badge badge-ghost">
                        {t('totalCasts')}: {pollData.totalCasts}
                    </span>
                </div>
            </div>

            <div className="space-y-3 mb-5">
                {pollData.options.map((option) => {
                    const percentage = getOptionPercentage(option.votes);
                    const isSelected = selectedOptionId === option.id;
                    const userCastAmount = userCastSummary?.byOption?.[option.id] || 0;

                    return (
                        <div
                            key={`poll-option-${option.id}`}
                            className={`card bg-base-200 shadow-md p-4 ${
                                isSelected ? "ring-2 ring-primary" : ""
                            } ${userCastAmount > 0 ? "bg-primary/10" : ""} ${
                                isExpired ? "opacity-70" : "hover:shadow-lg transition-shadow"
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <label className="flex items-center gap-2 cursor-pointer flex-1">
                                    <input
                                        type="radio"
                                        name="poll-option"
                                        value={option.id}
                                        checked={isSelected}
                                        disabled={isExpired}
                                        className="radio radio-primary"
                                        onChange={(e) => {
                                            if (!isExpired) {
                                                setSelectedOptionId(e.target.value);
                                                setError("");
                                            }
                                        }}
                                    />
                                    <span className="font-medium">{option.text}</span>
                                </label>
                                {userCastAmount > 0 && (
                                    <span className="badge badge-primary badge-sm">
                                        {t('you')}: {userCastAmount}
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <div className="w-full bg-base-300 rounded-full h-2 mb-1">
                                    <div
                                        className="bg-secondary h-2 rounded-full transition-all"
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                                <span className="text-xs opacity-60">
                                    {option.votes} {t('points')} ({percentage.toFixed(1)}%) / {option.casterCount} {t('casters')}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {!isExpired && (
                <div className="card bg-base-200 shadow-md p-4">
                    <div className="form-control mb-3">
                        <label className="label" htmlFor="cast-amount">
                            <span className="label-text">{t('amountLabel')}</span>
                            <span className="label-text-alt">{t('available')}: {balance}</span>
                        </label>
                        <input
                            id="cast-amount"
                            type="text"
                            inputMode="numeric"
                            value={amountInputValue}
                            className={`input input-bordered w-full ${amountValidationError ? 'input-error' : ''}`}
                            onChange={(e) => {
                                const inputValue = e.target.value;
                                // Always update input value for user to see what they type
                                setAmountInputValue(inputValue);
                                
                                // Validate explicitly
                                const validation = validateAmount(inputValue);
                                
                                if (validation.isValid && validation.numValue !== null) {
                                    // Valid - update both input and numeric value
                                    setAmountValidationError(null);
                                    setCastAmount(validation.numValue);
                                } else {
                                    // Invalid - show error but don't update castAmount yet
                                    setAmountValidationError(validation.error);
                                }
                            }}
                            onBlur={(e) => {
                                // Re-validate on blur explicitly
                                const inputValue = e.target.value;
                                const validation = validateAmount(inputValue);
                                
                                if (validation.isValid && validation.numValue !== null) {
                                    // Valid - clear error and ensure castAmount is set
                                    setAmountValidationError(null);
                                    setCastAmount(validation.numValue);
                                    // Ensure input value matches the validated value
                                    setAmountInputValue(validation.numValue.toString());
                                } else {
                                    // Invalid - show error
                                    setAmountValidationError(validation.error);
                                    // Don't update castAmount - keep previous valid value or 1
                                    if (castAmount < 1) {
                                        setCastAmount(1);
                                        setAmountInputValue("1");
                                    }
                                }
                            }}
                            disabled={isCasting}
                        />
                        {amountValidationError && (
                            <label className="label">
                                <span className="label-text-alt text-error">{amountValidationError}</span>
                            </label>
                        )}
                    </div>
                    {error && <div className="alert alert-error mb-3 py-2">{error}</div>}
                    <button
                        className="btn btn-primary w-full"
                        onClick={handleCastPoll}
                        disabled={isCasting || !selectedOptionId || amountValidationError !== null}
                    >
                        {isCasting ? t('casting') : t('castPoll')}
                    </button>
                </div>
            )}

            {userCastSummary && userCastSummary.castCount > 0 && (
                <div className="alert alert-info">
                    <span>{t('youCastSummary', { count: userCastSummary.castCount, amount: userCastSummary.totalAmount })}</span>
                </div>
            )}

            {isExpired && (
                <div className="alert alert-warning">
                    <span>{t('pollExpired')}</span>
                </div>
            )}
        </div>
    );
};

