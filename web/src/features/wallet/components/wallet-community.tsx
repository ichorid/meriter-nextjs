'use client';

import { swr } from "@lib/swr";
import { CardWithAvatar } from "@shared/components/card-with-avatar";

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
    const icon = info?.icon;
    const tags = info?.chat?.tags;
    if (!title) return null;
    return (
        <CardWithAvatar
            onClick={() =>
                (document.location.href = "/meriter/c/" + info?.chat?.chatId)
            }
        >
            <div className="title">{title}</div>
            <div className="amount flex items-center gap-2">
                <img src={icon} className="currency-icon" alt="currency" />
                {amount}
            </div>
            <div className="description">
                {tags && tags.map((t) => "#" + t).join(" ")}
            </div>
        </CardWithAvatar>
    );
};
