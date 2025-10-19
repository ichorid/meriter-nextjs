'use client';

import { swr } from "@lib/swr";
import { CommunityAvatarWithBadge } from "@shared/components/community-avatar-with-badge";

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

    const title = info?.chat?.title;
    const chatPhoto = info?.chat?.photo; // Community's Telegram avatar
    const icon = info?.icon; // Currency icon
    const tags = info?.chat?.tags;
    
    if (!title) return null;
    
    return (
        <div 
            className="card bg-base-100 shadow-md rounded-2xl mb-5 p-5 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => (document.location.href = "/meriter/communities/" + info?.chat?.chatId)}
        >
            <div className="flex items-start gap-4">
                <CommunityAvatarWithBadge
                    avatarUrl={chatPhoto}
                    communityName={title}
                    iconUrl={icon}
                    size={48}
                />
                <div className="flex-1">
                    <div className="title font-medium">{title}</div>
                    <div className="amount flex items-center gap-2 text-lg font-semibold">
                        {amount}
                    </div>
                    <div className="description text-sm opacity-60">
                        {tags && tags.map((t) => "#" + t).join(" ")}
                    </div>
                </div>
            </div>
        </div>
    );
};
