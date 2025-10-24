'use client';

import { classList } from '@lib/classList';
import { AvatarWithPlaceholder } from '@shared/components/avatar-with-placeholder';
import { CommunityAvatar } from '@shared/components/community-avatar';
import { useTranslations } from 'next-intl';

export const CardCommentVote = ({
    title,
    subtitle,
    avatarUrl,
    rate,
    content,
    bottom,
    onClick,
    onAvatarUrlNotFound,
    showCommunityAvatar,
    communityAvatarUrl,
    communityName,
    communityIconUrl,
    onCommunityClick,
    withdrawSliderContent,
    currencyIcon,
    voteType,
    amountFree,
    amountWallet,
    beneficiaryName,
    beneficiaryAvatarUrl,
}:any) => {
    const t = useTranslations('comments');
    
    // Get tooltip text based on vote type
    const getTooltipText = () => {
        switch(voteType) {
            case 'upvote-quota': return t('upvoteFromQuota');
            case 'upvote-wallet': return t('upvoteFromWallet');
            case 'upvote-mixed': return t('upvoteFromMixed');
            case 'downvote-quota': return t('downvoteFromQuota');
            case 'downvote-wallet': return t('downvoteFromWallet');
            case 'downvote-mixed': return t('downvoteFromMixed');
            default: return '';
        }
    };
    
    return (
    <div className="mb-4">
        <div 
            className={classList(
                "card bg-base-100 shadow-md rounded-xl overflow-hidden",
                onClick && "cursor-pointer hover:shadow-lg transition-shadow"
            )}
            onClick={onClick}
        >
            <div className="flex">
                <div className={classList(
                    "font-bold text-center py-2 px-3 min-w-[3rem] flex items-center justify-center gap-1",
                    // Default styling if no voteType
                    !voteType && "bg-secondary text-secondary-content",
                    // Upvote styles
                    voteType === 'upvote-wallet' && "bg-success text-success-content",
                    voteType === 'upvote-quota' && "bg-transparent border-2 border-success text-success",
                    voteType === 'upvote-mixed' && "bg-gradient-to-r from-success/80 to-success text-success-content",
                    // Downvote styles
                    voteType === 'downvote-wallet' && "bg-error text-error-content",
                    voteType === 'downvote-quota' && "bg-transparent border-2 border-error text-error",
                    voteType === 'downvote-mixed' && "bg-gradient-to-r from-error/80 to-error text-error-content"
                )}>
                    <span>{rate}</span>
                    {currencyIcon && (
                        <img 
                            src={currencyIcon} 
                            alt="Currency" 
                            className="w-4 h-4"
                            style={{ maxWidth: '16px', maxHeight: '16px' }}
                        />
                    )}
                    {/* Payment source icons */}
                    {voteType && (
                        <div className="flex gap-1 ml-1" title={getTooltipText()}>
                            {voteType.includes('quota') && !voteType.includes('mixed') && (
                                <span className="text-xs">⚡</span>
                            )}
                            {voteType.includes('wallet') && !voteType.includes('mixed') && (
                                <span className="text-xs">💰</span>
                            )}
                            {voteType.includes('mixed') && (
                                <>
                                    <span className="text-xs">⚡</span>
                                    <span className="text-xs">💰</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex-1">
                    <div className="p-4">
                        <div className="flex gap-2 mb-2 items-start">
                            <div className="flex gap-2 flex-1">
                                <AvatarWithPlaceholder
                                    avatarUrl={avatarUrl}
                                    name={title}
                                    size={32}
                                    onError={onAvatarUrlNotFound}
                                />
                                <div className="info">
                                    <div className="text-xs font-medium">{title}</div>
                                    <div className="text-[10px] opacity-60">{subtitle}</div>
                                </div>
                            </div>
                            {showCommunityAvatar && communityName && (
                                <div 
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onCommunityClick) onCommunityClick();
                                    }}
                                >
                                    <CommunityAvatar
                                        avatarUrl={communityAvatarUrl}
                                        communityName={communityName}
                                        size={28}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="content text-sm mb-2">{content}</div>
                        {/* Beneficiary information */}
                        {beneficiaryName && (
                            <div className="flex items-center gap-2 mb-2 text-xs opacity-70">
                                <span>to:</span>
                                <AvatarWithPlaceholder
                                    avatarUrl={beneficiaryAvatarUrl}
                                    name={beneficiaryName}
                                    size={16}
                                />
                                <span>{beneficiaryName}</span>
                            </div>
                        )}
                        <div className="bottom" onClick={(e) => e.stopPropagation()}>{bottom}</div>
                    </div>
                    {withdrawSliderContent && (
                        <>
                            <div className="divider my-0"></div>
                            <div className="withdraw-slider-section px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                {withdrawSliderContent}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    </div>
    );
};
