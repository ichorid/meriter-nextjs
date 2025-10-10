'use client';

import { useState } from "react";

export const CardWithAvatar = ({
    avatarUrl,
    avatarUrlUpd,
    iconUrl,
    iconOnClick,
    children,
    onClick,
}: {
    avatarUrl?: string;
    iconUrl?: string;
    iconOnClick?: () => any;
    children: React.ReactNode;
    onClick?: () => any;
    avatarUrlUpd?: (any) => any;
}) => {
    const [error, setError] = useState(false);
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
                <div className="avatar">
                    <div className="w-12 h-12 rounded-full">
                        {avatarUrl && !error && (
                            <img 
                                onError={(e) => {
                                    if (retryCount < 1 && avatarUrlUpd) {
                                        avatarUrlUpd(e);
                                        setTimeout(() => {
                                            setRetryCount(retryCount + 1);
                                            e.currentTarget.src = `${avatarUrl}?t=${Date.now()}`;
                                        }, 2000);
                                    } else {
                                        setError(true);
                                    }
                                }} 
                                src={avatarUrl}
                                alt="Avatar"
                                className="w-full h-full object-cover rounded-full"
                            />
                        )}
                    </div>
                </div>
                <div className="flex-1">{children}</div>
            </div>
        </div>
    );
};
