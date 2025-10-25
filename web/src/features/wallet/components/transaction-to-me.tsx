'use client';

import { CardCommentVote } from "@shared/components/card-comment-vote";
import { telegramGetAvatarLink } from "@lib/telegram";
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useCommunity } from '@/hooks/api';

class RestTransactionObject {
    amount: number = 0; //0
    amountFree: number = 0; //3
    amountTotal: number = 0; //3
    comment: string = ""; //"Три голоса плюс"
    currencyOfCommunityTgChatId: string = ""; //"-123123"
    directionPlus: boolean = true; //true
    forPublicationSlug: string = ""; //"abc123"
    fromUserTgId: string = ""; //"123123"
    fromUserTgName: string = ""; //"Some Name"
    inPublicationSlug: string = ""; //"123asdf"
    inSpaceSlug: string = ""; //"asdf"
    minus: number = 0; //0
    plus: number = 0; //0
    publicationClassTags: any[] = [];
    reason: string = ""; //"forPublication"
    sum: number = 0; //0
    toUserTgId: string = ""; //"123123"
    toUserTgName: string = ""; //"Some Name"
    ts: string = ""; //"2021-01-08T09:40:11.179Z"
    parentText: string = "";
    forTransactionId: string = "";
    _id: string = ""; //"123123"
}

export const TransactionToMe = ({
    transaction,
}: {
    transaction: RestTransactionObject;
}) => {
    const t = useTranslations('shared');
    
    // Fetch community info to get currency icon using v1 API
    const { data: communityInfo = {} } = useCommunity(transaction.currencyOfCommunityTgChatId || '');
    
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
    const currencyIcon = communityInfo?.settings?.iconUrl || communityInfo?.icon;
    
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
                beneficiaryName={transaction.fromUserTgName}
                beneficiaryAvatarUrl={telegramGetAvatarLink(transaction.toUserTgId)}
                onClick={() => {
                    // Navigate to the post page
                    if (transaction.inPublicationSlug && transaction.currencyOfCommunityTgChatId) {
                        window.location.href = `/meriter/communities/${transaction.currencyOfCommunityTgChatId}/posts/${transaction.inPublicationSlug}`;
                    }
                }}
                showCommunityAvatar={true}
                communityAvatarUrl={communityInfo?.avatarUrl || communityInfo?.chat?.photo}
                communityName={communityInfo?.name || communityInfo?.chat?.title}
                communityIconUrl={communityInfo?.settings?.iconUrl || communityInfo?.icon}
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
