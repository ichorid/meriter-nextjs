'use client';

import { CardPublication } from "./card-publication";
import { dateVerbose } from "@shared/lib/date";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from "@lib/telegram";
import { BarWithdraw } from "@features/wallet/components/bar-withdraw";
import { WithTelegramEntities } from "@shared/components/withTelegramEntities";
import { PollVoting } from "@features/polls/components/poll-voting";
import type { IPollData } from "@features/polls/types";
import { useEffect, useState } from "react";
import { apiPOST, apiGET } from "@shared/lib/fetch";

export const PublicationMy = ({
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
    setDirectionAdd,
    meritsAmount,
    showselector,
    withdrawMerits,
    setWithdrawMerits,
    tgAuthorId,
    entities,
    type,
    content,
    _id,
}: any) => {
    const [pollUserVote, setPollUserVote] = useState(null);
    const [pollData, setPollData] = useState<IPollData | null>(type === 'poll' ? content : null);

    // Fetch poll vote status if this is a poll
    useEffect(() => {
        if (type === 'poll' && _id) {
            apiGET("/api/rest/poll/get", { pollId: _id }).then((response) => {
                if (response.poll && response.poll.content) {
                    setPollData(response.poll.content);
                }
                if (response.userVote) {
                    setPollUserVote(response.userVote);
                }
            });
        }
    }, [type, _id]);

    const handlePollVoteSuccess = () => {
        // Refresh poll data after voting
        if (type === 'poll' && _id) {
            apiGET("/api/rest/poll/get", { pollId: _id }).then((response) => {
                if (response.poll && response.poll.content) {
                    setPollData(response.poll.content);
                }
                if (response.userVote) {
                    setPollUserVote(response.userVote);
                }
            });
        }
    };

    const avatarUrl = authorPhotoUrl || telegramGetAvatarLink(tgAuthorId);
    
    // Render poll publication
    if (type === 'poll' && pollData) {
        return (
            <CardPublication
                title={tgAuthorName}
                subtitle={dateVerbose(ts)}
                avatarUrl={avatarUrl}
                onAvatarUrlNotFound={() => {
                    const fallbackUrl = telegramGetAvatarLinkUpd(tgAuthorId);
                    if (fallbackUrl !== avatarUrl) {
                        // Force re-render with fallback avatar
                        const imgElement = document.querySelector(`img[src="${avatarUrl}"]`) as HTMLImageElement;
                        if (imgElement) imgElement.src = fallbackUrl;
                    }
                }}
                description="📊 Опрос (Мой)"
                onClick={undefined}
                onDescriptionClick={undefined}
                bottom={undefined}
            >
                <PollVoting
                    pollData={pollData}
                    pollId={_id || publicationSlug}
                    userVote={pollUserVote}
                    balance={meritsAmount || 0}
                    onVoteSuccess={handlePollVoteSuccess}
                />
            </CardPublication>
        );
    }

    return (
        <CardPublication
            title={tgAuthorName}
            subtitle={dateVerbose(ts)}
            avatarUrl={avatarUrl}
            onAvatarUrlNotFound={() => {
                const fallbackUrl = telegramGetAvatarLinkUpd(tgAuthorId);
                if (fallbackUrl !== avatarUrl) {
                    // Force re-render with fallback avatar
                    const imgElement = document.querySelector(`img[src="${avatarUrl}"]`) as HTMLImageElement;
                    if (imgElement) imgElement.src = fallbackUrl;
                }
            }}
            description={"#" + keyword}
            onClick={() => setDirectionAdd(false)}
            onDescriptionClick={() => {}}
            bottom={
                <BarWithdraw
                    balance={meritsAmount}
                    onWithdraw={() => setDirectionAdd(false)}
                    onTopup={() => setDirectionAdd(true)}
                >
                    {showselector && (
                        <div className="select-currency">
                            <span
                                className={
                                    !withdrawMerits
                                        ? "clickable bar-withdraw-select"
                                        : "bar-withdraw-select-active"
                                }
                                onClick={() => setWithdrawMerits(true)}
                            >
                                Мериты{" "}
                            </span>
                            <span
                                className={
                                    withdrawMerits
                                        ? "clickable bar-withdraw-select"
                                        : "bar-withdraw-select-active"
                                }
                                onClick={() => setWithdrawMerits(false)}
                            >
                                Баллы
                            </span>
                        </div>
                    )}
                </BarWithdraw>
            }
        >
            <WithTelegramEntities entities={entities}>
                {messageText}
            </WithTelegramEntities>
        </CardPublication>
    );
};
