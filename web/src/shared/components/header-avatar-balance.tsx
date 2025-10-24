'use client';

import { WidgetAvatarBalance } from '@shared/components/widget-avatar-balance';

interface HeaderAvatarBalanceProps {
    balance1?: {
        icon?: string;
        amount: number;
    };
    balance2?: {
        icon: string;
        amount: number;
    };
    avatarUrl?: string;
    onAvatarUrlNotFound?: () => void;
    children: React.ReactNode;
    onClick?: () => void;
    userName?: string;
}

export const HeaderAvatarBalance: React.FC<HeaderAvatarBalanceProps> = ({
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
            <div className="content">{children}</div>
            <WidgetAvatarBalance
                balance1={balance1}
                balance2={balance2}
                avatarUrl={avatarUrl}
                onAvatarUrlNotFound={onAvatarUrlNotFound}
                onClick={onClick}
                userName={userName}
            />
        </div>
        <div className="description">{null}</div>
    </div>
);
