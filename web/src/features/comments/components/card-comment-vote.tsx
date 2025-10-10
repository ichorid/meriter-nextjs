'use client';

import { classList } from '@lib/classList';

export const CardCommentVote = ({
    title,
    subtitle,
    avatarUrl,
    rate,
    content,
    bottom,
    onClick,
    onAvatarUrlNotFound
}:any) => (
    <div className="mb-4">
        <div className="card bg-base-100 shadow-md rounded-xl overflow-hidden">
            <div className="flex">
                <div className="bg-secondary text-secondary-content font-bold text-center py-2 px-3 min-w-[3rem]">
                    {rate}
                </div>
                <div className="flex-1 p-4">
                    <div className="flex gap-2 mb-2">
                        <div className="avatar">
                            <div className="w-8 h-8 rounded-full">
                                <img src={avatarUrl || undefined} onError={onAvatarUrlNotFound} alt={title} className="w-full h-full object-cover rounded-full"/>
                            </div>
                        </div>
                        <div className="info">
                            <div className="text-xs font-medium">{title}</div>
                            <div className="text-[10px] opacity-60">{subtitle}</div>
                        </div>
                    </div>
                    <div className="content text-sm mb-2">{content}</div>
                    <div className="bottom" onClick={(e) => e.stopPropagation()}>{bottom}</div>
                </div>
            </div>
        </div>
    </div>
);
