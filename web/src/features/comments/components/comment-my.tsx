'use client';

import { CardCommentVote } from "./card-comment-vote";
import { dateVerbose } from "@shared/lib/date";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from "@lib/telegram";
import { BarWithdraw } from "@features/wallet/components/bar-withdraw";
import { swr } from "@lib/swr";

export const CommentMy = ({
    slug: publicationSlug,
    transactionId,
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
    comment,
    fromUserTgId,
    showCommunityAvatar,
    currencyOfCommunityTgChatId,
    fromTgChatId,
    withdrawSliderContent,
}: any) => {
    const avatarUrl = telegramGetAvatarLink(fromUserTgId);
    
    // Fetch community info for displaying community avatar
    const communityId = currencyOfCommunityTgChatId || fromTgChatId || tgChatId;
    const [communityInfo] = swr(
        () => communityId && showCommunityAvatar ? `/api/rest/communityinfo?chatId=${communityId}` : null,
        {},
        { revalidateOnFocus: false }
    );
    
    return (
        <CardCommentVote
            title={tgAuthorName}
            subtitle={dateVerbose(ts)}
            avatarUrl={avatarUrl}
            onAvatarUrlNotFound={() => {
                const fallbackUrl = telegramGetAvatarLinkUpd(fromUserTgId);
                if (fallbackUrl !== avatarUrl) {
                    // Force re-render with fallback avatar
                    const imgElement = document.querySelector(`img[src="${avatarUrl}"]`) as HTMLImageElement;
                    if (imgElement) imgElement.src = fallbackUrl;
                }
            }}
            onClick={undefined}
            content={comment}
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
        />
    );
};
