'use client';

import { classList } from '@lib/classList';
import { Avatar } from '@/components/atoms';
import { CommunityAvatar } from '@shared/components/community-avatar';
import { useRouter } from 'next/navigation';
import { routes } from '@/lib/constants/routes';

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
    /** Cover image URL for the post */
    coverImageUrl?: string;
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
}: CardPublicationProps) => {
    const router = useRouter();
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
        {/* Cover Image - Twitter-style */}
        {coverImageUrl && (
            <div className="relative w-full aspect-video bg-base-200">
                <img 
                    src={coverImageUrl} 
                    alt="" 
                    className="w-full h-full object-cover"
                />
            </div>
        )}
        <div className="card-body p-0 max-w-full overflow-hidden">
            <div className="flex flex-col px-5 pt-5 gap-3 min-w-0">
                {/* Top row: Community avatar + time + description */}
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
                {/* Second row: Author + Beneficiary */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex gap-2.5 min-w-0 flex-1">
                        <Avatar
                            src={avatarUrl}
                            alt={title}
                            name={title}
                            size={32}
                            onError={onAvatarUrlNotFound}
                            onClick={authorId ? handleAuthorAvatarClick : undefined}
                        />
                        <div className="info min-w-0 flex-1">
                            <div className="text-xs font-medium text-base-content dark:text-base-content break-words">{title}</div>
                        </div>
                    </div>
                    {beneficiaryName && (
                        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
                            <span className="text-xs opacity-70 text-base-content dark:text-base-content flex-shrink-0">to:</span>
                            <Avatar
                                src={beneficiaryAvatarUrl}
                                alt={beneficiaryName}
                                name={beneficiaryName}
                                size={32}
                                onClick={beneficiaryId ? handleBeneficiaryAvatarClick : undefined}
                            />
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
            <div className="content px-5 py-5 overflow-hidden max-w-full break-words">
                {children}
            </div>
            <div className="bottom" onClick={(e) => e.stopPropagation()}>
                {bottom}
            </div>
        </div>
    </div>
);};  
