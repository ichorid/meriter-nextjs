'use client';

import { classList } from '@lib/classList';
import { Avatar } from '@/components/atoms';
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
    currencyIcon,
    voteType,
    amountFree,
    amountWallet,
    beneficiaryName,
    beneficiaryAvatarUrl,
    communityNeedsSetup,
    communityIsAdmin,
    upvotes,
    downvotes,
    onDetailsClick,
}:any) => {
    const t = useTranslations('comments');
    
    // Determine direction from voteType or rate
    const isUpvote = voteType?.includes('upvote') || (!voteType && rate && !rate.startsWith('-'));
    
    // Handle card click - open details popup if onDetailsClick provided, otherwise use onClick
    const handleCardClick = (e: React.MouseEvent) => {
        // Don't trigger if clicking on buttons or interactive elements
        const target = e.target as HTMLElement;
        const isClickable = target.closest('button') || 
                           target.closest('.cursor-pointer') && target.closest('.cursor-pointer') !== e.currentTarget;
        
        if (isClickable) {
            return; // Let the button handle its own click
        }
        
        // Prioritize onDetailsClick if provided (opens popup)
        // Otherwise fall back to onClick (navigation)
        if (onDetailsClick) {
            e.stopPropagation();
            onDetailsClick();
        } else if (onClick) {
            onClick();
        }
    };
    
    return (
    <div className="mb-4 w-full overflow-hidden">
        <div 
            className={classList(
                "card bg-base-100 shadow-md dark:border dark:border-base-content/20 rounded-xl overflow-hidden w-full",
                (onDetailsClick || onClick) && "cursor-pointer hover:shadow-lg transition-shadow"
            )}
            onClick={handleCardClick}
        >
            <div className="flex min-w-0">
                <div 
                    className={classList(
                        "font-bold text-center py-2 px-3 min-w-[3rem] flex flex-col items-center justify-center gap-1",
                        // Default styling if no voteType
                        !voteType ? "bg-secondary text-secondary-content" : "",
                        // Upvote styles
                        voteType === 'upvote-wallet' ? "bg-success text-success-content" : "",
                        voteType === 'upvote-quota' ? "bg-transparent border-2 border-success text-success" : "",
                        voteType === 'upvote-mixed' ? "bg-gradient-to-r from-success/80 to-success text-success-content" : "",
                        // Downvote styles
                        voteType === 'downvote-wallet' ? "bg-error text-error-content" : "",
                        voteType === 'downvote-quota' ? "bg-transparent border-2 border-error text-error" : "",
                        voteType === 'downvote-mixed' ? "bg-gradient-to-r from-error/80 to-error text-error-content" : ""
                    )}
                >
                    <div className="flex items-center justify-center">
                        <span>{rate}</span>
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="p-4">
                        <div className="flex gap-2 mb-2 items-start min-w-0">
                            <div className="flex gap-2 flex-1 min-w-0">
                                <Avatar
                                    src={avatarUrl}
                                    alt={title}
                                    name={title}
                                    size={32}
                                    onError={onAvatarUrlNotFound}
                                />
                                <div className="info min-w-0 flex-1">
                                    <div className="text-xs font-medium break-words">{title}</div>
                                    <div className="text-[10px] opacity-60 break-words">{subtitle}</div>
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
                                        needsSetup={communityNeedsSetup}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="content text-sm mb-2 break-words">{content}</div>
                        {/* Beneficiary information */}
                        {beneficiaryName && (
                            <div className="flex items-center gap-2 mb-2 text-xs opacity-70 min-w-0">
                                <span className="flex-shrink-0">to:</span>
                                <Avatar
                                    src={beneficiaryAvatarUrl}
                                    alt={beneficiaryName}
                                    name={beneficiaryName}
                                    size={16}
                                />
                                <span className="break-words min-w-0">{beneficiaryName}</span>
                            </div>
                        )}
                        <div className="bottom" onClick={(e) => e.stopPropagation()}>{bottom}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    );
};
