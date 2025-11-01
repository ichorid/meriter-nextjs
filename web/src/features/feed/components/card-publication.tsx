'use client';

import { classList } from '@lib/classList';
import { Avatar } from '@/components/atoms';
import { CommunityAvatar } from '@shared/components/community-avatar';

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
}: CardPublicationProps) => {
    const clickableClass = onClick ? " cursor-pointer hover:shadow-xl" : "";
    
    return (
    <div 
        className={`card bg-base-100 shadow-lg rounded-2xl mb-5 overflow-hidden transition-all${clickableClass}`}
        onClick={onClick}
    >
        <div className="card-body p-0">
            <div className="flex flex-col px-5 pt-5 gap-3">
                {/* Top row: Community avatar + time + description */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
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
                                    size={24}
                                    needsSetup={communityNeedsSetup}
                                />
                            </div>
                        )}
                        <div className="text-[10px] opacity-60">{subtitle}</div>
                    </div>
                    <div
                        className="description text-right opacity-30 cursor-pointer hover:opacity-50 text-xs"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onDescriptionClick) onDescriptionClick();
                        }}
                    >
                        {description}
                    </div>
                </div>
                {/* Second row: Author + Beneficiary */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-2.5">
                        <Avatar
                            src={avatarUrl}
                            alt={title}
                            name={title}
                            size={32}
                            onError={onAvatarUrlNotFound}
                        />
                        <div className="info">
                            <div className="text-xs font-medium">{title}</div>
                        </div>
                    </div>
                    {beneficiaryName && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs opacity-70">to:</span>
                            <Avatar
                                src={beneficiaryAvatarUrl}
                                alt={beneficiaryName}
                                name={beneficiaryName}
                                size={32}
                            />
                            <div className="info">
                                <div className="text-xs font-medium">{beneficiaryName}</div>
                                {beneficiarySubtitle && (
                                    <div className="text-[10px] opacity-60">{beneficiarySubtitle}</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="content px-5 py-5 overflow-hidden">
                {children}
            </div>
            <div className="bottom" onClick={(e) => e.stopPropagation()}>
                {bottom}
            </div>
        </div>
    </div>
);};  
