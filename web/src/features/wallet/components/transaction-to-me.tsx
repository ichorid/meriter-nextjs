'use client';

import { CardCommentVote } from "@features/comments/components/card-comment-vote";
import { telegramGetAvatarLink } from "@lib/telegram";
import { BarVote } from "@shared/components/bar-vote";
import { useTranslation } from 'react-i18next';
import Link from "next/link";
import { swr } from "@lib/swr";

class RestTransactionObject {
    amount: number; //0
    amountFree: number; //3
    amountTotal: number; //3
    comment: string; //"Три голоса плюс"
    currencyOfCommunityTgChatId: string; //"-123123"
    directionPlus: boolean; //true
    forPublicationSlug: string; //"abc123"
    fromUserTgId: string; //"123123"
    fromUserTgName: string; //"Some Name"
    inPublicationSlug: string; //"123asdf"
    inSpaceSlug: string; //"asdf"
    minus: number; //0
    plus: number; //0
    publicationClassTags: [];
    reason: string; //"forPublication"
    sum: number; //0
    toUserTgId: string; //"123123"
    ts: string; //"2021-01-08T09:40:11.179Z",
    parentText: string;
    forTransactionId: string;

    _id: string; //"123123"
}

export const TransactionToMe = ({
    transaction,
}: {
    transaction: RestTransactionObject;
}) => {
    const { t } = useTranslation('shared');
    
    // Fetch community info to get currency icon
    const [communityInfo] = swr(
        transaction.currencyOfCommunityTgChatId 
            ? `/api/rest/communityinfo?chatId=${transaction.currencyOfCommunityTgChatId}`
            : null,
        {},
        { revalidateOnFocus: false }
    );
    
    const parentTextCut = transaction.parentText
        ? transaction.parentText.length < 80
            ? transaction.parentText
            : transaction.parentText?.substr(0, 80) + "..."
        : t('thisPost');
    
    // Format the rate with currency icon
    const formatRate = () => {
        const amount = Math.abs(transaction.amountTotal);
        const sign = transaction.directionPlus ? "+" : "-";
        return `${sign} ${amount}`;
    };
    
    // Get currency icon for separate rendering
    const currencyIcon = communityInfo?.icon;
    
    return (
        <div>
            <CardCommentVote
                title={`${t('from')} ${transaction.fromUserTgName}`}
                subtitle={new Date(transaction.ts).toLocaleString()}
                content={transaction.comment}
                rate={formatRate()}
                currencyIcon={currencyIcon}
                avatarUrl={telegramGetAvatarLink(
                    transaction.reason === "withdrawalFromPublication"
                        ? transaction.toUserTgId
                        : transaction.fromUserTgId
                )}
                showCommunityAvatar={true}
                communityAvatarUrl={communityInfo?.chat?.photo}
                communityName={communityInfo?.chat?.title}
                communityIconUrl={communityInfo?.icon}
                onCommunityClick={() => {
                    if (transaction.currencyOfCommunityTgChatId) {
                        window.location.href = `/meriter/communities/${transaction.currencyOfCommunityTgChatId}`;
                    }
                }}
                bottom={
                    transaction.inPublicationSlug && (
                        <div>
                            {t('inReplyTo')}{" "}
                            <Link
                                href={`/meriter/communities/${transaction.currencyOfCommunityTgChatId}/posts/${transaction.inPublicationSlug}${
                                    transaction.forTransactionId
                                        ? "#" + transaction.forTransactionId
                                        : ""
                                }`}
                                className="link link-hover"
                            >
                                {parentTextCut ? parentTextCut : t('thisPost')}
                            </Link>
                        </div>
                    )
                }
            />
        </div>
    );
};
