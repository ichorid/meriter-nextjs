'use client';

import { classList } from '@lib/classList';
import { AvatarWithPlaceholder } from '@shared/components/avatar-with-placeholder';
import { CommunityAvatarWithBadge } from '@shared/components/community-avatar-with-badge';

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
}:any) => (
    <div className="mb-4">
        <div className="card bg-base-100 shadow-md rounded-xl overflow-hidden">
            <div className="flex">
                <div className="bg-secondary text-secondary-content font-bold text-center py-2 px-3 min-w-[3rem]">
                    {rate}
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
                                    <CommunityAvatarWithBadge
                                        avatarUrl={communityAvatarUrl}
                                        communityName={communityName}
                                        iconUrl={communityIconUrl}
                                        size={28}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="content text-sm mb-2">{content}</div>
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
