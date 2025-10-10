'use client';

import { WidgetAvatarBalance } from "@features/wallet/components/widget-avatar-balance";

export const HeaderAvatarBalance = ({
    balance1,
    balance2,
    avatarUrl,
    onAvatarUrlNotFound,
    children,
    onClick,
}) => (
    <div className="mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="content">{children?.[0] ?? children ?? null}</div>
            <WidgetAvatarBalance
                balance1={balance1}
                balance2={balance2}
                avatarUrl={avatarUrl}
                onAvatarUrlNotFound={onAvatarUrlNotFound}
                onClick={onClick}
            />
        </div>
        <div className="description">{children?.[1] ?? null}</div>
    </div>
);
