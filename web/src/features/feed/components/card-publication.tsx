'use client';

import { classList } from '@lib/classList';
import { AvatarWithPlaceholder } from '@shared/components/avatar-with-placeholder';

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
}) => {
    const clickableClass = onClick ? " cursor-pointer hover:shadow-xl" : "";
    
    return (
    <div 
        className={`card bg-base-100 shadow-lg rounded-2xl mb-5 overflow-hidden transition-all${clickableClass}`}
        onClick={onClick}
    >
        <div className="card-body p-0">
            <div className="grid grid-cols-2 px-5 pt-5">
                <div className="flex gap-2.5">
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
                <div
                    className="description text-right mt-4 mr-5 opacity-30 cursor-pointer hover:opacity-50"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onDescriptionClick) onDescriptionClick();
                    }}
                >
                    {description}
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
