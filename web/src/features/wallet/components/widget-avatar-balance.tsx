'use client';

import { classList } from '@lib/classList';
import { AvatarWithPlaceholder } from '@shared/components/avatar-with-placeholder';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface WidgetAvatarBalanceProps {
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
    onClick?: () => void;
    userName?: string;
}

export const WidgetAvatarBalance: React.FC<WidgetAvatarBalanceProps> = ({
    balance1,
    balance2,
    avatarUrl,
    onAvatarUrlNotFound,
    onClick,
    userName,
}) => {
    const t = useTranslations('shared');
    const router = useRouter();

    const handleSettingsClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        router.push('/meriter/settings');
    };

    return (
        <div className="cursor-pointer" onClick={onClick}>
            <div className="bg-base-100 shadow-md rounded-2xl p-1.5 sm:p-4 flex items-center gap-1.5 sm:gap-3 relative">
                <div className="flex-1 min-w-0 text-right text-xs sm:text-sm">
                    {balance1 && (
                        <div className="flex items-center justify-end gap-1 mb-1">
                            {balance1.icon && <span className="text-xs opacity-60">{t('balance')} </span>}
                            {balance1.icon && <img className="w-4 h-4 inline" src={balance1.icon} alt="Currency" />}
                            <span className="font-medium">{balance1.amount}</span>
                        </div>
                    )}
                    {balance2 && (
                        <div className="flex items-center justify-end gap-1">
                            <img className="w-4 h-4 inline" src={balance2.icon} alt="Currency" />
                            <span className="font-medium">{balance2.amount}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-1">
                    <div className="text-right min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-medium text-base-content truncate">
                            {userName || 'User'}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5">
                        <AvatarWithPlaceholder
                            avatarUrl={avatarUrl}
                            name={userName || 'User'}
                            size={40}
                            className="w-10 h-10 sm:w-12 sm:h-12"
                            onError={onAvatarUrlNotFound}
                        />
                        <button
                            onClick={handleSettingsClick}
                            className="btn btn-ghost btn-circle btn-xs opacity-60 hover:opacity-100"
                            aria-label="Settings"
                            title="Settings"
                        >
                            <span className="material-symbols-outlined text-xs">settings</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
