import { CardCommentVote } from "../frontend/card-comment-vote";
import { dateVerbose } from "../projects/meriter/utils/date";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from "../bots/telegram/telegramapi";
import { BarWithdraw } from "../frontend/bar-withdraw";

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
    return (
        <CardCommentVote
            title={tgAuthorName}
            subtitle={dateVerbose(ts)}
            avatarUrl={telegramGetAvatarLink(fromUserTgId)}
            onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(fromUserTgId)}
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
