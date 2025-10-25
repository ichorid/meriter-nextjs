'use client';

import { useState, useEffect } from "react";
import { IPollData, IPollVote, IPollUserVoteSummary } from "../types";
import { useTranslations } from 'next-intl';
import { pollsApiV1 } from '@/lib/api/v1';

interface IPollVotingProps {
    pollData: IPollData;
    pollId: string;
    userVote?: IPollVote;
    userVoteSummary?: IPollUserVoteSummary;
    balance: number;
    onVoteSuccess?: () => void;
    updateWalletBalance?: (currencyOfCommunityTgChatId: string, amountChange: number) => void;
    communityId?: string;
    initiallyExpanded?: boolean;
}

export const PollVoting = ({
    pollData,
    pollId,
    userVote,
    userVoteSummary,
    balance,
    onVoteSuccess,
    updateWalletBalance,
    communityId,
    initiallyExpanded = false,
}: IPollVotingProps) => {
    const t = useTranslations('polls');
    const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
    const [voteAmount, setVoteAmount] = useState<number>(1);
    const [isVoting, setIsVoting] = useState(false);
    const [error, setError] = useState<string>("");

    const now = new Date();
    const expiresAt = new Date(pollData.expiresAt);
    const isExpired = now > expiresAt;

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

    const handleVote = async () => {
        if (!selectedOptionId) {
            setError(t('selectOption'));
            return;
        }

        if (voteAmount <= 0) {
            setError(t('specifyAmount'));
            return;
        }

        if (voteAmount > balance) {
            setError(t('insufficientPoints'));
            return;
        }

        setIsVoting(true);
        setError("");

        // Optimistically update the wallet balance (voting decreases balance)
        if (updateWalletBalance && communityId) {
            updateWalletBalance(communityId, -voteAmount);
        }

        try {
            await pollsApiV1.voteOnPoll(pollId, {
                optionId: selectedOptionId,
                amount: voteAmount,
            });

            onVoteSuccess && onVoteSuccess();
        } catch (err: any) {
            const errorMessage = err?.response?.data?.message || err?.message || t('voteError');
            setError(errorMessage);
            // Revert optimistic update on error
            if (updateWalletBalance && communityId) {
                updateWalletBalance(communityId, voteAmount);
            }
        } finally {
            setIsVoting(false);
        }
    };

    const getOptionPercentage = (votes: number) => {
        if (pollData.totalVotes === 0) return 0;
        return (votes / pollData.totalVotes) * 100;
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
                        🗳 {pollData.totalVotes} {t('votes')}
                    </span>
                    {userVoteSummary && userVoteSummary.voteCount > 0 && (
                        <span className="badge badge-sm badge-primary">
                            {t('youVoted')}
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
                        {t('totalVotes')}: {pollData.totalVotes}
                    </span>
                </div>
            </div>

            <div className="space-y-3 mb-5">
                {pollData.options.map((option) => {
                    const percentage = getOptionPercentage(option.votes);
                    const isSelected = selectedOptionId === option.id;
                    const userVotedAmount = userVoteSummary?.byOption?.[option.id] || 0;

                    return (
                        <div
                            key={`poll-option-${option.id}`}
                            className={`card bg-base-200 shadow-md p-4 ${
                                isSelected ? "ring-2 ring-primary" : ""
                            } ${userVotedAmount > 0 ? "bg-primary/10" : ""} ${
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
                                {userVotedAmount > 0 && (
                                    <span className="badge badge-primary badge-sm">
                                        {t('you')}: {userVotedAmount}
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
                                    {option.votes} {t('points')} ({percentage.toFixed(1)}%) / {option.voterCount} {t('voters')}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {!isExpired && (
                <div className="card bg-base-200 shadow-md p-4">
                    <div className="form-control mb-3">
                        <label className="label" htmlFor="vote-amount">
                            <span className="label-text">{t('amountLabel')}</span>
                            <span className="label-text-alt">{t('available')}: {balance}</span>
                        </label>
                        <input
                            id="vote-amount"
                            type="number"
                            min="1"
                            max={balance}
                            value={voteAmount}
                            className="input input-bordered w-full"
                            onChange={(e) => setVoteAmount(parseInt(e.target.value) || 0)}
                            disabled={isVoting}
                        />
                    </div>
                    {error && <div className="alert alert-error mb-3 py-2">{error}</div>}
                    <button
                        className="btn btn-primary w-full"
                        onClick={handleVote}
                        disabled={isVoting || !selectedOptionId}
                    >
                        {isVoting ? t('voting') : t('vote')}
                    </button>
                </div>
            )}

            {userVoteSummary && userVoteSummary.voteCount > 0 && (
                <div className="alert alert-info">
                    <span>{t('youVotedSummary', { count: userVoteSummary.voteCount, amount: userVoteSummary.totalAmount })}</span>
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

