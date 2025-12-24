'use client';

import { useState } from 'react';
import { classList } from '@lib/classList';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { CommunityAvatar } from '@shared/components/community-avatar';
import { useRouter } from 'next/navigation';
import { routes } from '@/lib/constants/routes';
import { ImageLightbox } from '@shared/components/image-lightbox';
import { ImageViewer } from '@/components/ui/ImageViewer/ImageViewer';
import { ImageGalleryDisplay } from '@shared/components/image-gallery-display';

interface CardPublicationProps {
    title: any;
    subtitle: any;
    description: any;
    avatarUrl: any;
    children: any;
    bottom?: any;
    onClick?: any;
    onAvatarUrlNotFound?: any;
    onDescriptionClick?: any;
    showCommunityAvatar?: any;
    communityAvatarUrl?: any;
    communityName?: any;
    communityIconUrl?: any;
    onCommunityClick?: any;
    communityNeedsSetup?: any;
    communityIsAdmin?: any;
    beneficiaryName?: any;
    beneficiaryAvatarUrl?: any;
    beneficiarySubtitle?: any;
    authorId?: string;
    beneficiaryId?: string;
    coverImageUrl?: string;
    galleryImages?: string[];
}

export const CardPublication = ({
    title,
    subtitle,
    description,
    avatarUrl,
    children,
    bottom,
    onClick,
    onAvatarUrlNotFound,
    onDescriptionClick,
    showCommunityAvatar,
    communityAvatarUrl,
    communityName,
    communityIconUrl,
    onCommunityClick,
    communityNeedsSetup,
    communityIsAdmin,
    beneficiaryName,
    beneficiaryAvatarUrl,
    beneficiarySubtitle,
    authorId,
    beneficiaryId,
    coverImageUrl,
    galleryImages = [],
}: CardPublicationProps) => {
    const router = useRouter();
    const [viewingImageIndex, setViewingImageIndex] = useState<number | null>(null);
    const clickableClass = onClick ? " cursor-pointer hover:shadow-xl" : "";
    
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
    
    return (
    <div 
        className={`card bg-base-100 shadow-lg dark:border dark:border-base-content/20 rounded-2xl mb-5 overflow-hidden max-w-full transition-all${clickableClass}`}
        onClick={onClick}
    >
        {coverImageUrl && galleryImages.length === 0 && (
            <ImageGalleryDisplay
                images={[coverImageUrl]}
                altPrefix={title ? `${title} - Cover` : 'Publication cover'}
                initialIndex={viewingImageIndex}
                onClose={() => setViewingImageIndex(null)}
                onImageClick={(index) => setViewingImageIndex(index)}
            />
        )}
        <div className="card-body p-0 max-w-full overflow-hidden">
            <div className="flex flex-col px-5 pt-5 gap-3 min-w-0">
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
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
                                    size={24}
                                    needsSetup={communityNeedsSetup}
                                />
                            </div>
                        )}
                        <div className="text-[10px] opacity-60 text-base-content dark:text-base-content break-words min-w-0">{subtitle}</div>
                    </div>
                    <div
                        className="description text-right opacity-30 cursor-pointer hover:opacity-50 text-xs text-base-content dark:text-base-content break-words flex-shrink-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onDescriptionClick) onDescriptionClick();
                        }}
                    >
                        {description}
                    </div>
                </div>
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex gap-2.5 min-w-0 flex-1">
                        <Avatar
                            className="w-8 h-8 cursor-pointer"
                            onClick={authorId ? handleAuthorAvatarClick : undefined}
                        >
                          <AvatarImage src={avatarUrl} alt={title} onError={onAvatarUrlNotFound} />
                          <AvatarFallback className="bg-muted text-muted-foreground font-medium text-xs">
                            {title ? title.charAt(0).toUpperCase() : '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="info min-w-0 flex-1">
                            <div className="text-xs font-medium text-base-content dark:text-base-content break-words">{title}</div>
                        </div>
                    </div>
                    {beneficiaryName && (
                        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
                            <span className="text-xs opacity-70 text-base-content dark:text-base-content flex-shrink-0">to:</span>
                            <Avatar
                                className="w-8 h-8 cursor-pointer"
                                onClick={beneficiaryId ? handleBeneficiaryAvatarClick : undefined}
                            >
                              <AvatarImage src={beneficiaryAvatarUrl} alt={beneficiaryName} />
                              <AvatarFallback className="bg-muted text-muted-foreground font-medium text-xs">
                                {beneficiaryName ? beneficiaryName.charAt(0).toUpperCase() : '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="info min-w-0">
                                <div className="text-xs font-medium text-base-content dark:text-base-content break-words">{beneficiaryName}</div>
                                {beneficiarySubtitle && (
                                    <div className="text-[10px] opacity-60 text-base-content dark:text-base-content break-words">{beneficiarySubtitle}</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {galleryImages.length > 0 && (
                <ImageGalleryDisplay
                    images={galleryImages}
                    altPrefix={title ? `${title} - Image` : 'Publication image'}
                    initialIndex={viewingImageIndex}
                    onClose={() => setViewingImageIndex(null)}
                    onImageClick={(index) => setViewingImageIndex(index)}
                />
            )}
            <div className="content px-5 py-5 overflow-hidden max-w-full break-words">
                {children}
            </div>
            <div className="bottom" onClick={(e) => e.stopPropagation()}>
                {bottom}
            </div>
        </div>
    </div>
);};  
