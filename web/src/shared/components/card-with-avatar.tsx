'use client';

import { useState } from "react";
import { AvatarWithPlaceholder } from '@shared/components/avatar-with-placeholder';

export const CardWithAvatar = ({
    avatarUrl,
    avatarUrlUpd,
    iconUrl,
    iconOnClick,
    children,
    onClick,
    userName,
}: {
    avatarUrl?: string;
    iconUrl?: string;
    iconOnClick?: () => any;
    children: React.ReactNode;
    onClick?: () => any;
    avatarUrlUpd?: (any) => any;
    userName?: string;
}) => {
    const [retryCount, setRetryCount] = useState(0);
    
    const baseClasses = "card bg-base-100 shadow-md rounded-2xl mb-5 p-5";
    const clickableClass = onClick ? " cursor-pointer hover:shadow-lg transition-shadow" : "";
    
    if (!avatarUrl && !iconUrl)
        return (
            <div
                className={`${baseClasses}${clickableClass}`}
                onClick={onClick}
            >
                <div>{children}</div>
            </div>
        );

    if (iconUrl && !avatarUrl) {
        return (
            <div
                className={`${baseClasses}${clickableClass}`}
                onClick={onClick}
            >
                <div className="flex items-start gap-4">
                    <div className="flex-1">{children}</div>
                    <div 
                        className="cursor-pointer w-12 h-12"
                        onClick={iconOnClick}
                    >
                        {iconUrl && <img src={iconUrl} alt="Icon" className="w-full h-full object-contain" />}
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div
            className={`${baseClasses}${clickableClass}`}
            onClick={onClick}
        >
            <div className="flex items-start gap-4">
                <AvatarWithPlaceholder
                    avatarUrl={avatarUrl}
                    name={userName || 'User'}
                    size={48}
                    onError={() => {
                        if (retryCount < 1 && avatarUrlUpd) {
                            avatarUrlUpd({});
                            setRetryCount(retryCount + 1);
                        }
                    }}
                />
                <div className="flex-1">{children}</div>
            </div>
        </div>
    );
};
