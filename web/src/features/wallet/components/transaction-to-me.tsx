'use client';

import { CardCommentVote } from "@features/comments/components/card-comment-vote";
import { telegramGetAvatarLink } from "@lib/telegram";
import { BarVote } from "@shared/components/bar-vote";

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
    const parentTextCut = transaction.parentText
        ? transaction.parentText.length < 80
            ? transaction.parentText
            : transaction.parentText?.substr(0, 80) + "..."
        : "эту запись";
    return (
        <div>
            <CardCommentVote
                title={"от " + transaction.fromUserTgName}
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
                            В ответ на:{" "}
                            <a
                                href={`/mt/${transaction.inSpaceSlug}/${
                                    transaction.inPublicationSlug
                                }${
                                    transaction.forTransactionId
                                        ? "#" + transaction.forTransactionId
                                        : ""
                                }`}
                            >
                                {parentTextCut ? parentTextCut : "эту запись"}
                            </a>
                        </div>
                    )
                }
            />
        </div>
    );
};
