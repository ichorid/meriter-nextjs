'use client';

import { swr } from "@lib/swr";
import { CommunityAvatar } from "@shared/components/community-avatar";

export const WalletCommunity = ({
    amount,
    currencyNames,
    currencyOfCommunityTgChatId,
    tgUserId,
}) => {
    const [info] = swr(
        "/api/rest/communityinfo?chatId=" + currencyOfCommunityTgChatId,
        {},
        { revalidateOnFocus: false }
    );

    const [user] = swr("/api/rest/getme", { init: true });

    const title = info?.chat?.title;
    const chatPhoto = info?.chat?.photo; // Community's Telegram avatar
    const icon = info?.icon; // Currency icon
    const tags = info?.chat?.tags;
    const administratorsIds = info?.chat?.administratorsIds || [];
    
    // Check if current user is admin
    const isAdmin = user?.tgUserId && administratorsIds.includes(user.tgUserId);
    
    if (!title) return null;
    
    return (
        <div 
            className="card bg-base-100 shadow-md rounded-2xl mb-5 p-5 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => (document.location.href = "/meriter/communities/" + info?.chat?.chatId)}
        >
            <div className="flex items-start gap-4">
                <CommunityAvatar
                    avatarUrl={chatPhoto}
                    communityName={title}
                    size={48}
                />
                <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <div className="title font-medium">{title}</div>
                            {isAdmin && (
                                <div 
                                    className="tooltip tooltip-bottom" 
                                    data-tip="You are an administrator"
                                >
                                    <svg 
                                        className="w-4 h-4 text-primary" 
                                        fill="currentColor" 
                                        viewBox="0 0 20 20"
                                    >
                                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {icon && <img className="w-5 h-5" src={icon} alt="Currency" />}
                            <span className="text-lg font-semibold">{amount}</span>
                        </div>
                    </div>
                    <div className="description text-sm opacity-60 mt-2">
                        {tags && tags.map((t) => "#" + t).join(" ")}
                    </div>
                </div>
            </div>
        </div>
    );
};
