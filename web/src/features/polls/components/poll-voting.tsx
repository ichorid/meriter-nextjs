'use client';

import { useState, useEffect } from "react";
import { IPollData, IPollVote } from "../types";
import { apiPOST } from "@shared/lib/fetch";

interface IPollVotingProps {
    pollData: IPollData;
    pollId: string;
    userVote?: IPollVote;
    balance: number;
    onVoteSuccess?: () => void;
}

export const PollVoting = ({
    pollData,
    pollId,
    userVote,
    balance,
    onVoteSuccess,
}: IPollVotingProps) => {
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
        userVote?.optionId || null
    );
    const [voteAmount, setVoteAmount] = useState<number>(1);
    const [isVoting, setIsVoting] = useState(false);
    const [error, setError] = useState<string>("");

    const now = new Date();
    const expiresAt = new Date(pollData.expiresAt);
    const isExpired = now > expiresAt;
    const hasVoted = !!userVote;

    // Calculate time remaining
    const getTimeRemaining = () => {
        const diff = expiresAt.getTime() - now.getTime();
        if (diff <= 0) return "Завершен";

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `${days} дн ${hours} ч`;
        if (hours > 0) return `${hours} ч ${minutes} мин`;
        return `${minutes} мин`;
    };

    const handleVote = async () => {
        if (!selectedOptionId) {
            setError("Выберите вариант ответа");
            return;
        }

        if (voteAmount <= 0) {
            setError("Укажите количество баллов");
            return;
        }

        if (voteAmount > balance) {
            setError("Недостаточно баллов");
            return;
        }

        setIsVoting(true);
        setError("");

        try {
            const response = await apiPOST("/api/rest/poll/vote", {
                pollId,
                optionId: selectedOptionId,
                amount: voteAmount,
            });

            if (response.error) {
                setError(response.error);
            } else {
                onVoteSuccess && onVoteSuccess();
            }
        } catch (err) {
            setError("Ошибка при голосовании");
        } finally {
            setIsVoting(false);
        }
    };

    const getOptionPercentage = (votes: number) => {
        if (pollData.totalVotes === 0) return 0;
        return (votes / pollData.totalVotes) * 100;
    };

    return (
        <div className="p-5 bg-base-100">
            <div className="mb-5">
                <h3 className="text-lg font-bold mb-2">{pollData.title}</h3>
                {pollData.description && (
                    <p className="text-sm opacity-70 mb-3">{pollData.description}</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`badge ${isExpired ? "badge-error" : "badge-success"}`}>
                        {isExpired ? "🔴 Завершен" : "🟢 Активен"}
                    </span>
                    <span className="badge badge-ghost">
                        {isExpired ? "Опрос завершен" : `Осталось: ${getTimeRemaining()}`}
                    </span>
                    <span className="badge badge-ghost">
                        Всего голосов: {pollData.totalVotes}
                    </span>
                </div>
            </div>

            <div className="space-y-3 mb-5">
                {pollData.options.map((option) => {
                    const percentage = getOptionPercentage(option.votes);
                    const isSelected = selectedOptionId === option.id;
                    const isUserVoted = userVote?.optionId === option.id;

                    return (
                        <div
                            key={`poll-option-${option.id}`}
                            className={`card bg-base-200 shadow-md p-4 ${
                                isSelected ? "ring-2 ring-primary" : ""
                            } ${isUserVoted ? "bg-primary/10" : ""} ${
                                isExpired || hasVoted ? "opacity-70" : "hover:shadow-lg transition-shadow"
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <label className="flex items-center gap-2 cursor-pointer flex-1">
                                    <input
                                        type="radio"
                                        name="poll-option"
                                        value={option.id}
                                        checked={isSelected}
                                        disabled={isExpired || hasVoted}
                                        className="radio radio-primary"
                                        onChange={(e) => {
                                            if (!isExpired && !hasVoted) {
                                                setSelectedOptionId(e.target.value);
                                                setError("");
                                            }
                                        }}
                                    />
                                    <span className="font-medium">{option.text}</span>
                                </label>
                                {isUserVoted && (
                                    <span className="badge badge-primary badge-sm">
                                        Вы: {userVote.amount}
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
                                    {option.votes} баллов ({percentage.toFixed(1)}%) от{" "}
                                    {option.voterCount} голосов
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {!isExpired && !hasVoted && (
                <div className="card bg-base-200 shadow-md p-4">
                    <div className="form-control mb-3">
                        <label className="label" htmlFor="vote-amount">
                            <span className="label-text">Количество баллов:</span>
                            <span className="label-text-alt">Доступно: {balance}</span>
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
                        {isVoting ? "Голосую..." : "Проголосовать"}
                    </button>
                </div>
            )}

            {hasVoted && (
                <div className="alert alert-success">
                    <span>✓ Вы проголосовали за "{pollData.options.find(o => o.id === userVote.optionId)?.text}" 
                    {" "}с {userVote.amount} баллами</span>
                </div>
            )}

            {isExpired && !hasVoted && (
                <div className="alert alert-warning">
                    <span>Опрос завершен. Голосование больше недоступно.</span>
                </div>
            )}
        </div>
    );
};

