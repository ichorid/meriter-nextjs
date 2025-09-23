import { useComments } from "./use-comments.hook";
import { useEffect, useState } from "react";
import { CardPublication } from "../frontend/card-publication";
import { dateVerbose } from "../projects/meriter/utils/date";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from "../bots/telegram/telegramapi";
import { BarVote } from "../frontend/bar-vote";
import { WithTelegramEntities } from "./withTelegramEntities";
import { FormDimensionsEditor } from "../frontend/form-dimensions-editor";
import Axios from "axios";
import { BottomPortal } from "./bottom-portal";
import { FormComment } from "./form-comment";
import { classList } from "../pages/meriter/[...page]";
import { Comment } from "./comment";

export interface IPublication {
    tgChatName;
    tgMessageId;
    minus;
    plus;
    sum;
    slug;
    spaceSlug;
    balance;
    updBalance;
    messageText;
    authorPhotoUrl;
    tgAuthorName;
    keyword;
    ts;
}

export const Publication = ({
    tgChatName,
    tgMessageId,
    minus,
    plus,
    sum,
    slug,
    spaceSlug,
    balance,
    updBalance,
    messageText,
    authorPhotoUrl,
    tgAuthorName,
    keyword,
    ts,
    activeCommentHook,
    tgAuthorId,
    dimensions,
    dimensionConfig,
    myId,
    onlyPublication,
    entities,
    highlightTransactionId,
}: any) => {
    if (!tgChatName) return null;
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
        false,
        slug,
        undefined,
        "/api/rest/transaction?forPublicationSlug=" + slug,
        "/api/rest/free?inSpaceSlug=" + spaceSlug,
        balance,
        updBalance,
        plus,
        minus,
        activeCommentHook,
        onlyPublication
    );

    useEffect(() => {
        if (onlyPublication) showPlus();
    }, [onlyPublication]);

    const publicationUnderReply = activeCommentHook[0] == slug;
    if (publicationUnderReply) console.log("PUBLICATION REPLY", slug);
    const nobodyUnderReply = activeCommentHook[0] === null;
    const [showDimensionsEditor, setShowDimensionsEditor] = useState(false);
    const tagsStr = [
        "#" + keyword,
        ...(Object.entries(dimensions || {}) || [])
            .map(([slug, dim]) => "#" + dim)
            .flat(),
    ].join(" ");

    return (
        <div
            className={classList(
                "publication",
                publicationUnderReply && "reply",
                nobodyUnderReply && "noreply"
            )}
            onClick={(e) => {
                if (
                    activeCommentHook[0] &&
                    myId !== tgAuthorId &&
                    !(e.target as any)?.className?.match("clickable")
                ) {
                    activeCommentHook[1] && activeCommentHook[1](null);
                }
            }}
            key={slug}
        >
            <CardPublication
                title={tgAuthorName}
                subtitle={dateVerbose(ts)}
                avatarUrl={authorPhotoUrl ?? telegramGetAvatarLink(tgAuthorId)}
                onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId)}
                description={tagsStr}
                onClick={!(myId == tgAuthorId) && showPlus}
                onDescriptionClick={
                    myId == tgAuthorId && (() => setShowDimensionsEditor(true))
                }
                bottom={
                    <BarVote
                        plus={currentPlus}
                        minus={currentMinus}
                        onPlus={showPlus}
                        onMinus={showMinus}
                        onLeft={
                            showComments
                                ? () => setShowComments(false)
                                : () => setShowComments(true)
                        }
                    />
                }
            >
                <WithTelegramEntities entities={entities}>
                    {messageText}
                </WithTelegramEntities>
            </CardPublication>
            {showDimensionsEditor && dimensionConfig && tgAuthorId == myId && (
                <FormDimensionsEditor
                    level="publication"
                    dimensions={dimensions}
                    dimensionConfig={dimensionConfig}
                    onSave={(dimensions) => {
                        Axios.post("/api/d/meriter/setdimensions", {
                            publicationSlug: slug,
                            dimensions,
                        });
                    }}
                />
            )}

            {showComments && (
                <div className="publication-comments">
                    <div className="comments">
                        {comments?.map((c) => (
                            <Comment
                                key={c._id}
                                {...c}
                                balance={balance}
                                updBalance={updBalance}
                                spaceSlug={spaceSlug}
                                inPublicationSlug={slug}
                                activeCommentHook={activeCommentHook}
                                myId={myId}
                                highlightTransactionId={highlightTransactionId}
                            />
                        ))}
                    </div>
                </div>
            )}
            {publicationUnderReply && !(tgAuthorId == myId) && (
                <BottomPortal>
                    {" "}
                    <FormComment {...formCommentProps} />
                </BottomPortal>
            )}
        </div>
    );
};
