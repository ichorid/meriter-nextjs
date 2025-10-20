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
import { swr } from "@lib/swr";

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
    updateWalletBalance,
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
    showCommunityAvatar,
    wallets,
    withdrawSliderContent,
}: any) => {
    const [pollUserVote, setPollUserVote] = useState(null);
    const [pollData, setPollData] = useState<IPollData | null>(type === 'poll' ? content : null);
    
    // For polls, get the wallet balance for the specific community from the wallets array
    const pollCommunityId = type === 'poll' ? content?.communityId : null;
    const pollWalletBalance = pollCommunityId && wallets
        ? (wallets.find((w: any) => w.currencyOfCommunityTgChatId === pollCommunityId)?.amount || 0)
        : 0;
    
    // Fetch community info for displaying community avatar
    const communityId = tgChatId || pollCommunityId;
    const [communityInfo] = swr(
        () => communityId && showCommunityAvatar ? `/api/rest/communityinfo?chatId=${communityId}` : null,
        {},
        { revalidateOnFocus: false }
    );

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
        // Use pollWalletBalance when on home/dashboard (showCommunityAvatar=true), otherwise use meritsAmount
        const effectiveBalance = showCommunityAvatar ? pollWalletBalance : (meritsAmount || 0);
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
                showCommunityAvatar={showCommunityAvatar}
                communityAvatarUrl={communityInfo?.chat?.photo}
                communityName={communityInfo?.chat?.title || tgChatName}
                communityIconUrl={communityInfo?.icon}
                onCommunityClick={() => {
                    if (communityId) {
                        window.location.href = `/meriter/communities/${communityId}`;
                    }
                }}
                withdrawSliderContent={withdrawSliderContent}
            >
                <PollVoting
                    pollData={pollData}
                    pollId={_id || publicationSlug}
                    userVote={pollUserVote}
                    balance={effectiveBalance}
                    onVoteSuccess={handlePollVoteSuccess}
                    updateWalletBalance={updateWalletBalance}
                    communityId={pollCommunityId}
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
            onClick={undefined}
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
            showCommunityAvatar={showCommunityAvatar}
            communityAvatarUrl={communityInfo?.chat?.photo}
            communityName={communityInfo?.chat?.title || tgChatName}
            communityIconUrl={communityInfo?.icon}
            onCommunityClick={() => {
                if (communityId) {
                    window.location.href = `/meriter/communities/${communityId}`;
                }
            }}
            withdrawSliderContent={withdrawSliderContent}
        >
            <WithTelegramEntities entities={entities}>
                {messageText}
            </WithTelegramEntities>
        </CardPublication>
    );
};
