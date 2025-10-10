'use client';

import { useComments } from "../hooks/use-comments";
import { CardCommentVote } from "./card-comment-vote";
import { telegramGetAvatarLink, telegramGetAvatarLinkUpd } from "@lib/telegram";
import { BarVote } from "@shared/components/bar-vote";
import { BottomPortal } from "@shared/components/bottom-portal";
import { FormComment } from "./form-comment";
import { classList } from "@lib/classList";

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
    const userTgId = reason === "withdrawalFromPublication" ? toUserTgId : fromUserTgId;
    const avatarUrl = telegramGetAvatarLink(userTgId);
    
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
                avatarUrl={avatarUrl}
                onAvatarUrlNotFound={() => {
                    const fallbackUrl = telegramGetAvatarLinkUpd(userTgId);
                    if (fallbackUrl !== avatarUrl) {
                        // Force re-render with fallback avatar
                        const imgElement = document.querySelector(`img[src="${avatarUrl}"]`) as HTMLImageElement;
                        if (imgElement) imgElement.src = fallbackUrl;
                    }
                }}
                bottom={
                    <BarVote
                        plus={currentPlus}
                        minus={currentMinus}
                        onPlus={showPlus}
                        onMinus={showMinus}
                        onLeft={setShowComments}
                        commentCount={comments?.length || 0}
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
                    <FormComment key={formCommentProps.uid} {...formCommentProps} />
                </BottomPortal>
            )}
        </div>
    );
};
