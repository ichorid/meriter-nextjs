'use client';

import { useState } from "react";
import { IPollData, IPollCast, IPollUserCastSummary } from "../types";
import { useTranslations } from 'next-intl';
import { useCastPoll } from '@/hooks/api/usePolls';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';

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
    const [castAmount, setCastAmount] = useState<number>(1);
    const [error, setError] = useState<string>("");

    const castPollMutation = useCastPoll();

    const now = new Date();
    const expiresAt = new Date(pollData.expiresAt);
    const isExpired = now > expiresAt;
    const isCasting = castPollMutation.isPending;

    // Calculate time remaining
    const getTimeRemaining = () => {
        const diff = expiresAt.getTime() - now.getTime();
        if (diff <= 0) return t('finished');

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `${days} ${t('days')} ${hours} ${t('hours')}`;
        if (hours > 0) return `${hours} ${t('hours')} ${minutes} ${t('minutes')}`;
        return `${minutes} ${t('minutes')}`;
    };

    const handleCastPoll = async () => {
        if (!selectedOptionId) {
            setError(t('selectOption'));
            return;
        }

        if (castAmount <= 0) {
            setError(t('specifyAmount'));
            return;
        }

        if (castAmount > balance) {
            setError(t('insufficientPoints'));
            return;
        }

        setError("");

        try {
            await castPollMutation.mutateAsync({
                id: pollId,
                data: {
                    optionId: selectedOptionId,
                    amount: castAmount,
                },
                communityId,
            });

            // Reset form
            setCastAmount(1);
            setSelectedOptionId(null);
            
            onCastSuccess && onCastSuccess();
        } catch (err: unknown) {
            const errorMessage = extractErrorMessage(err, t('castError'));
            setError(errorMessage);
        }
    };

    const getOptionPercentage = (votes: number) => {
        if (pollData.totalCasts === 0) return 0;
        return (votes / pollData.totalCasts) * 100;
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
                        {isExpired ? t('pollFinished') : `${t('timeRemaining')} ${getTimeRemaining()}`}
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
                        {isExpired ? t('pollFinished') : `${t('timeRemaining')}: ${getTimeRemaining()}`}
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
                            type="number"
                            min="1"
                            max={balance}
                            value={castAmount}
                            className="input input-bordered w-full"
                            onChange={(e) => setCastAmount(parseInt(e.target.value) || 0)}
                            disabled={isCasting}
                        />
                    </div>
                    {error && <div className="alert alert-error mb-3 py-2">{error}</div>}
                    <button
                        className="btn btn-primary w-full"
                        onClick={handleCastPoll}
                        disabled={isCasting || !selectedOptionId}
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

