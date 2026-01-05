'use client';

import { useState } from 'react';
import { classList } from '@lib/classList';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
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
}: any) => {
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
        <div className="mb-3 w-full">
            <div
                className="w-full bg-base-200 rounded-xl p-4 relative"
            >
                {/* Share button in top right corner */}
                {communityId && publicationSlug && commentId && (
                    <button
                        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-base-content/50 hover:text-base-content/70 hover:bg-base-200/50 transition-all duration-200 z-10"
                        onClick={handleShareClick}
                        title={tShared('share')}
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                    </button>
                )}

                <div className="flex gap-3 min-w-0">
                    {/* Vote section - vertical on the left */}
                    <div className="flex flex-col items-center gap-1 pt-1">
                        <div
                            className={classList(
                                "text-lg font-bold tabular-nums",
                                !voteType ? "text-base-content/60" : "",
                                voteType?.includes('upvote') ? "text-success" : "",
                                voteType?.includes('downvote') ? "text-error" : ""
                            )}
                        >
                            {rate}
                        </div>
                    </div>

                    {/* Content section */}
                    <div className="flex-1 min-w-0">
                        <div className="flex gap-3 mb-2 items-start min-w-0">
                            <Avatar
                                className="w-8 h-8 cursor-pointer flex-shrink-0"
                                onClick={authorId ? handleAuthorAvatarClick : undefined}
                            >
                                <AvatarImage
                                    src={avatarUrl}
                                    alt={title}
                                    onError={onAvatarUrlNotFound}
                                />
                                <AvatarFallback userId={authorId || title} className="font-medium text-xs">
                                    {title ? title.charAt(0).toUpperCase() : '?'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-base-content">{title}</span>
                                    <span className="text-xs text-base-content/50">{subtitle}</span>
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
                                                communityId={communityId}
                                                size={20}
                                                needsSetup={communityNeedsSetup}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="text-sm text-base-content/90 mt-2 leading-relaxed break-words">{content}</div>

                                {/* Images gallery */}
                                {Array.isArray(images) && images.length > 0 && (
                                    <div className="mt-3 -mx-1" onClick={(e) => e.stopPropagation()}>
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
                                    <div className="flex items-center gap-2 mt-2 text-xs text-base-content/70 min-w-0 py-1 px-2 bg-base-200/30 rounded-lg inline-flex">
                                        <span className="flex-shrink-0 font-medium">to:</span>
                                        <Avatar
                                            className="w-4 h-4 cursor-pointer"
                                            onClick={beneficiaryId ? handleBeneficiaryAvatarClick : undefined}
                                        >
                                            <AvatarImage
                                                src={beneficiaryAvatarUrl}
                                                alt={beneficiaryName}
                                            />
                                            <AvatarFallback userId={beneficiaryId || beneficiaryName} className="font-medium text-[10px]">
                                                {beneficiaryName ? beneficiaryName.charAt(0).toUpperCase() : '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="break-words min-w-0 font-medium">{beneficiaryName}</span>
                                    </div>
                                )}

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
