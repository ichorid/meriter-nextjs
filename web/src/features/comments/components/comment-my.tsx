'use client';

import { CardCommentVote } from "./card-comment-vote";
import { dateVerbose } from "@shared/lib/date";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from "@lib/telegram";
import { BarWithdraw } from "@features/wallet/components/bar-withdraw";

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
}: any) => {
    const avatarUrl = telegramGetAvatarLink(fromUserTgId);
    
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
            onClick={() => setDirectionAdd(false)}
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
        />
    );
};
