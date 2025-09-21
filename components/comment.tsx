import { useComments } from "./use-comments.hook";
import { CardCommentVote } from "../frontend/card-comment-vote";
import { telegramGetAvatarLink } from "../bots/telegram/telegramapi";
import { BarVote } from "../frontend/bar-vote";
import { BottomPortal } from "./bottom-portal";
import { FormComment } from "./form-comment";
import { classList } from "../pages/meriter/[...page]";

export const Comment = ({
    _id,
    spaceSlug,
    balance,
    updBalance,
    plus,
    minus,
    fromUserTgName,
    ts,
    comment,
    directionPlus,
    reason,
    toUserTgId,
    fromUserTgId,
    amountTotal,
    inPublicationSlug,
    activeCommentHook,
    myId,
    highlightTransactionId,
}) => {
    const {
        comments,
        showPlus,
        currentPlus,
        currentMinus,
        showMinus,
        showComments,
        setShowComments,
        formCommentProps,
    } = useComments(
        true,
        inPublicationSlug,
        _id,
        "/api/rest/transaction?forTransactionId=" + _id,
        "/api/rest/free?inSpaceSlug=" + spaceSlug,
        balance,
        updBalance,
        plus,
        minus,
        activeCommentHook
    );
    const commentUnderReply = activeCommentHook[0] == _id;
    const nobodyUnderReply = activeCommentHook[0] === null;
    return (
        <div
            className={classList(
                "comment-vote-wrapper",
                commentUnderReply && "reply",
                nobodyUnderReply && "noreply",
                highlightTransactionId == _id && "highlight"
            )}
            key={_id}
            onClick={(e) => {
                if (
                    activeCommentHook[0] &&
                    //(myId!==fromUserTgId) &&
                    !(e.target as any)?.className?.match("clickable")
                ) {
                    activeCommentHook[1](null);
                }
            }}
        >
            <CardCommentVote
                title={fromUserTgName}
                subtitle={new Date(ts).toLocaleString()}
                content={comment}
                rate={`${directionPlus ? "+" : "-"} ${amountTotal}`}
                avatarUrl={telegramGetAvatarLink(
                    reason === "withdrawalFromPublication"
                        ? toUserTgId
                        : fromUserTgId
                )}
                bottom={
                    <BarVote
                        plus={currentPlus}
                        minus={currentMinus}
                        onPlus={showPlus}
                        onMinus={showMinus}
                        onLeft={setShowComments}
                    />
                }
            />
            {showComments && (
                <div className="transaction-comments">
                    <div className="comments">
                        {comments.map((c) => (
                            <Comment
                                key={c._id}
                                {...c}
                                myId={myId}
                                balance={balance}
                                updBalance={updBalance}
                                spaceSlug={spaceSlug}
                                inPublicationSlug={inPublicationSlug}
                                activeCommentHook={activeCommentHook}
                                highlightTransactionId={highlightTransactionId}
                            />
                        ))}
                    </div>
                </div>
            )}
            {commentUnderReply && fromUserTgId !== myId && (
                <BottomPortal>
                    {" "}
                    <FormComment {...formCommentProps} />
                </BottomPortal>
            )}
        </div>
    );
};
