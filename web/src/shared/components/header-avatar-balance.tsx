'use client';

import { WidgetAvatarBalance } from "@features/wallet/components/widget-avatar-balance";

export const HeaderAvatarBalance = ({
    balance1,
    balance2,
    avatarUrl,
    onAvatarUrlNotFound,
    children,
    onClick,
    userName,
}) => (
    <div className="mb-3 sm:mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 mb-2 sm:mb-4">
            <div className="content">{children?.[0] ?? children ?? null}</div>
            <WidgetAvatarBalance
                balance1={balance1}
                balance2={balance2}
                avatarUrl={avatarUrl}
                onAvatarUrlNotFound={onAvatarUrlNotFound}
                onClick={onClick}
                userName={userName}
            />
        </div>
        <div className="description">{children?.[1] ?? null}</div>
    </div>
);
