'use client';

import { useState } from 'react';
import { classList } from '@lib/classList';
import { Avatar } from '@/components/atoms';
import { CommunityAvatar } from '@shared/components/community-avatar';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { routes } from '@/lib/constants/routes';
import { shareUrl, getCommentUrl } from '../lib/share-utils';
import { ImageLightbox } from '@shared/components/image-lightbox';
import { ImageGalleryDisplay } from '@shared/components/image-gallery-display';
import { hapticImpact } from '@shared/lib/utils/haptic-utils';

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
    authorId,
    beneficiaryId,
    communityId,
    publicationSlug,
    commentId,
    images = [],
}:any) => {
    const t = useTranslations('comments');
    const tShared = useTranslations('shared');
    const router = useRouter();
    const [viewingImageIndex, setViewingImageIndex] = useState<number | null>(null);
    
    const handleAuthorAvatarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (authorId) {
            router.push(routes.userProfile(authorId));
        }
    };
    
    const handleBeneficiaryAvatarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (beneficiaryId) {
            router.push(routes.userProfile(beneficiaryId));
        }
    };
    
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

    const handleShareClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        hapticImpact('light');
        if (communityId && publicationSlug && commentId) {
            const url = getCommentUrl(communityId, publicationSlug, commentId);
            await shareUrl(url, tShared('urlCopiedToBuffer'));
        }
    };
    
    return (
    <div className="mb-4 w-full overflow-hidden">
        <div 
            className={classList(
                "bg-base-100 shadow-sm dark:border dark:border-base-content/10 rounded-2xl overflow-hidden w-full",
                (onDetailsClick || onClick) && "cursor-pointer hover:shadow-md transition-all duration-200"
            )}
            onClick={handleCardClick}
        >
            <div className="flex min-w-0">
                <div 
                    className={classList(
                        "font-semibold text-center py-4 px-5 min-w-[4rem] flex flex-col items-center justify-center",
                        // Default styling if no voteType - gluestack style with subtle border
                        !voteType ? "bg-base-200/50 text-base-content border-r border-base-300/50" : "",
                        // Upvote styles - clean solid colors with subtle borders
                        voteType === 'upvote-wallet' ? "bg-success text-success-content border-r border-success/30" : "",
                        voteType === 'upvote-quota' ? "bg-success/10 text-success border-r-2 border-success/50 border-r border-success/30" : "",
                        voteType === 'upvote-mixed' ? "bg-success text-success-content border-r border-success/30" : "",
                        // Downvote styles - clean solid colors with subtle borders
                        voteType === 'downvote-wallet' ? "bg-error text-error-content border-r border-error/30" : "",
                        voteType === 'downvote-quota' ? "bg-error/10 text-error border-r-2 border-error/50 border-r border-error/30" : "",
                        voteType === 'downvote-mixed' ? "bg-error text-error-content border-r border-error/30" : ""
                    )}
                >
                    <div className="flex items-center justify-center text-xl font-bold tabular-nums tracking-tight">
                        <span>{rate}</span>
                    </div>
                </div>
                <div className="flex-1 min-w-0 bg-transparent">
                    <div className="p-5">
                        <div className="flex gap-3 mb-3 items-start min-w-0">
                            <div className="flex gap-3 flex-1 min-w-0">
                                <Avatar
                                    src={avatarUrl}
                                    alt={title}
                                    name={title}
                                    size={32}
                                    onError={onAvatarUrlNotFound}
                                    onClick={authorId ? handleAuthorAvatarClick : undefined}
                                />
                                <div className="info min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-base-content break-words leading-tight">{title}</div>
                                    <div className="text-xs text-base-content/60 break-words mt-0.5">{subtitle}</div>
                                </div>
                            </div>
                            {showCommunityAvatar && communityName && (
                                <div 
                                    className="cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
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
                        <div className="content text-sm text-base-content/90 mb-3 leading-relaxed break-words">{content}</div>
                        {/* Images gallery - показываем превью, при клике открывается лайтбокс */}
                        {Array.isArray(images) && images.length > 0 && (
                            <div className="mb-4 -mx-1" onClick={(e) => e.stopPropagation()}>
                                <ImageGalleryDisplay
                                    images={images}
                                    altPrefix="Comment image"
                                    maxColumns={3}
                                    onImageClick={(index) => {
                                        setViewingImageIndex(index);
                                    }}
                                />
                            </div>
                        )}
                        {/* Beneficiary information */}
                        {beneficiaryName && (
                            <div className="flex items-center gap-2 mb-3 text-xs text-base-content/70 min-w-0 py-1.5 px-2 bg-base-200/50 rounded-lg">
                                <span className="flex-shrink-0 font-medium">to:</span>
                                <Avatar
                                    src={beneficiaryAvatarUrl}
                                    alt={beneficiaryName}
                                    name={beneficiaryName}
                                    size={20}
                                    onClick={beneficiaryId ? handleBeneficiaryAvatarClick : undefined}
                                />
                                <span className="break-words min-w-0 font-medium">{beneficiaryName}</span>
                            </div>
                        )}
                        <div className="bottom border-t border-base-300/50 pt-3 mt-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                                {bottom}
                                {communityId && publicationSlug && commentId && (
                                    <button
                                        className="flex items-center justify-center h-8 w-8 rounded-lg text-base-content/50 hover:text-base-content/70 hover:bg-base-200/50 transition-all duration-200"
                                        onClick={handleShareClick}
                                        title={tShared('share')}
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="18" cy="5" r="3"></circle>
                                            <circle cx="6" cy="12" r="3"></circle>
                                            <circle cx="18" cy="19" r="3"></circle>
                                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        {/* Lightbox для изображений комментария */}
        {Array.isArray(images) && images.length > 0 && viewingImageIndex !== null && (
            <ImageLightbox
                images={images}
                altPrefix="Comment image"
                initialIndex={viewingImageIndex}
                isOpen={viewingImageIndex !== null}
                onClose={() => setViewingImageIndex(null)}
            />
        )}
    </div>
    );
};
