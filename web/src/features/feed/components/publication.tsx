'use client';

import { useComments } from "@features/comments/hooks/use-comments";
import { useEffect, useState } from "react";
import { CardPublication } from "./card-publication";
import { dateVerbose } from "@shared/lib/date";
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from "@lib/telegram";
import { BarVote } from "@shared/components/bar-vote";
import { WithTelegramEntities } from "@shared/components/withTelegramEntities";
import { FormDimensionsEditor } from "@features/communities/components/form-dimensions-editor";
import Axios from "axios";
import { BottomPortal } from "@shared/components/bottom-portal";
import { FormComment } from "@features/comments/components/form-comment";
import { classList } from "@lib/classList";
import { Comment } from "@features/comments/components/comment";
import { PollVoting } from "@features/polls/components/poll-voting";
import type { IPollData } from "@features/polls/types";
import { apiPOST, apiGET } from "@shared/lib/fetch";
import { useRouter } from "next/navigation";

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
    type?: string;
    content?: any;
    _id?: string;
}

export const Publication = ({
    tgChatName,
    tgChatId,
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
    type,
    content,
    _id,
    isDetailPage,
}: any) => {
    if (!tgChatName && type !== 'poll') return null;
    const router = useRouter();
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
        "/api/rest/transactions/publications/" + slug,
        "/api/rest/free?inSpaceSlug=" + spaceSlug,
        balance,
        updBalance,
        plus,
        minus,
        activeCommentHook,
        onlyPublication
    );

    useEffect(() => {
        if (onlyPublication || isDetailPage) {
            showPlus();
            setShowComments(true);
        }
    }, [onlyPublication, isDetailPage]);

    const publicationUnderReply = activeCommentHook[0] == slug;
    const nobodyUnderReply = activeCommentHook[0] === null;
    const [showDimensionsEditor, setShowDimensionsEditor] = useState(false);
    const [pollUserVote, setPollUserVote] = useState(null);
    const [pollData, setPollData] = useState<IPollData | null>(type === 'poll' ? content : null);
    
    const tagsStr = [
        "#" + keyword,
        ...(Object.entries(dimensions || {}) || [])
            .map(([slug, dim]) => "#" + dim)
            .flat(),
    ].join(" ");

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

    // Render poll publication
    if (type === 'poll' && pollData) {
        const avatarUrl = authorPhotoUrl || telegramGetAvatarLink(tgAuthorId);
        return (
            <div
                className={classList(
                    "publication",
                    "poll-publication",
                    publicationUnderReply && "reply",
                    nobodyUnderReply && "noreply"
                )}
                key={slug}
            >
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
                    description="📊 Опрос"
                    onClick={undefined}
                    onDescriptionClick={undefined}
                    bottom={undefined}
                >
                    <PollVoting
                        pollData={pollData}
                        pollId={_id || slug}
                        userVote={pollUserVote}
                        balance={balance}
                        onVoteSuccess={handlePollVoteSuccess}
                    />
                </CardPublication>
            </div>
        );
    }

    const avatarUrl = authorPhotoUrl || telegramGetAvatarLink(tgAuthorId);
    
    return (
        <div
            className={classList(
                "mb-5 transition-all duration-300",
                publicationUnderReply ? "scale-100 opacity-100" : 
                nobodyUnderReply ? "scale-100 opacity-100" : 
                "scale-95 opacity-60"
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
                avatarUrl={avatarUrl}
                onAvatarUrlNotFound={() => {
                    const fallbackUrl = telegramGetAvatarLinkUpd(tgAuthorId);
                    if (fallbackUrl !== avatarUrl) {
                        // Force re-render with fallback avatar
                        const imgElement = document.querySelector(`img[src="${avatarUrl}"]`) as HTMLImageElement;
                        if (imgElement) imgElement.src = fallbackUrl;
                    }
                }}
                description={tagsStr}
                onClick={!(myId == tgAuthorId) && !isDetailPage ? () => {
                    // Navigate to post detail page
                    if (tgChatId && slug) {
                        router.push(`/meriter/communities/${tgChatId}/posts/${slug}`);
                    }
                } : undefined}
                onDescriptionClick={
                    myId == tgAuthorId ? () => setShowDimensionsEditor(true) : undefined
                }
                bottom={
                    <BarVote
                        plus={currentPlus}
                        minus={currentMinus}
                        onPlus={showPlus}
                        onMinus={showMinus}
                        onLeft={!isDetailPage ? () => {
                            // Navigate to post detail page
                            if (tgChatId && slug) {
                                router.push(`/meriter/communities/${tgChatId}/posts/${slug}`);
                            }
                        } : () => {
                            // On detail page, comment counter is visible but not clickable
                        }}
                        commentCount={comments?.length || 0}
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
                        // Dead API call - endpoint /api/d/meriter/setdimensions doesn't exist
                        console.warn('SetDimensions endpoint not implemented', { slug, dimensions });
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
                    <FormComment key={formCommentProps.uid} {...formCommentProps} />
                </BottomPortal>
            )}
        </div>
    );
};
