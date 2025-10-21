'use client';

import { CardCommentVote } from "@features/comments/components/card-comment-vote";
import { telegramGetAvatarLink } from "@lib/telegram";
import { BarVote } from "@shared/components/bar-vote";
import { useTranslation } from 'react-i18next';

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
    const parentTextCut = transaction.parentText
        ? transaction.parentText.length < 80
            ? transaction.parentText
            : transaction.parentText?.substr(0, 80) + "..."
        : t('thisPost');
    return (
        <div>
            <CardCommentVote
                title={`${t('from')} ${transaction.fromUserTgName}`}
                subtitle={new Date(transaction.ts).toLocaleString()}
                content={transaction.comment}
                rate={`${transaction.directionPlus ? "+" : "-"} ${Math.abs(
                    transaction.amountTotal
                )}`}
                avatarUrl={telegramGetAvatarLink(
                    transaction.reason === "withdrawalFromPublication"
                        ? transaction.toUserTgId
                        : transaction.fromUserTgId
                )}
                bottom={
                    transaction.inPublicationSlug && (
                        <div>
                            {t('inReplyTo')}{" "}
                            <a
                                href={`/meriter/${transaction.inSpaceSlug}/${
                                    transaction.inPublicationSlug
                                }${
                                    transaction.forTransactionId
                                        ? "#" + transaction.forTransactionId
                                        : ""
                                }`}
                            >
                                {parentTextCut ? parentTextCut : t('thisPost')}
                            </a>
                        </div>
                    )
                }
            />
        </div>
    );
};
