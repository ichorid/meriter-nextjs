'use client';

import { CardCommentVote } from "@features/comments/components/card-comment-vote";
import { telegramGetAvatarLink } from "@lib/telegram";
import { useTranslation } from 'react-i18next';
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
    
    // Format the rate with currency icon
    const formatRate = () => {
        const amount = Math.abs(transaction.amountTotal);
        const sign = transaction.directionPlus ? "+" : "-";
        return `${sign} ${amount}`;
    };
    
    // Determine vote type based on payment source
    const determineVoteType = () => {
        const amountFree = transaction.amountFree || 0;
        const amountWallet = Math.abs(transaction.amountTotal) - Math.abs(amountFree);
        
        const isQuota = amountFree > 0;
        const isWallet = amountWallet > 0;
        
        if (transaction.directionPlus) {
            if (isQuota && isWallet) return 'upvote-mixed';
            return isQuota ? 'upvote-quota' : 'upvote-wallet';
        } else {
            if (isQuota && isWallet) return 'downvote-mixed';
            return isQuota ? 'downvote-quota' : 'downvote-wallet';
        }
    };
    
    const voteType = determineVoteType();
    
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
                voteType={voteType}
                amountFree={transaction.amountFree || 0}
                amountWallet={Math.abs(transaction.amountTotal) - Math.abs(transaction.amountFree || 0)}
                beneficiaryName={transaction.toUserTgName}
                beneficiaryAvatarUrl={telegramGetAvatarLink(transaction.toUserTgId)}
                onClick={() => {
                    // Navigate to the post page
                    if (transaction.inPublicationSlug && transaction.currencyOfCommunityTgChatId) {
                        window.location.href = `/meriter/communities/${transaction.currencyOfCommunityTgChatId}/posts/${transaction.inPublicationSlug}`;
                    }
                }}
                showCommunityAvatar={true}
                communityAvatarUrl={communityInfo?.chat?.photo}
                communityName={communityInfo?.chat?.title}
                communityIconUrl={communityInfo?.icon}
                onCommunityClick={() => {
                    if (transaction.currencyOfCommunityTgChatId) {
                        window.location.href = `/meriter/communities/${transaction.currencyOfCommunityTgChatId}`;
                    }
                }}
                bottom={null}
            />
        </div>
    );
};
