'use client';

import { classList } from '@lib/classList';
import { AvatarWithPlaceholder } from '@shared/components/avatar-with-placeholder';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

export const WidgetAvatarBalance = ({
    balance1,
    balance2,
    avatarUrl,
    onAvatarUrlNotFound,
    onClick,
    userName,
}) => {
    const { t } = useTranslation('shared');
    const router = useRouter();

    const handleSettingsClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        router.push('/meriter/settings');
    };

    return (
        <div className="cursor-pointer" onClick={onClick}>
            <div className="bg-base-100 shadow-md rounded-2xl p-4 flex items-center gap-3 relative">
            <div className="flex-1 text-right text-sm">
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
            <div className="flex items-center gap-2">
                <div className="text-right">
                    <div className="text-sm font-medium text-base-content">
                        {userName || 'User'}
                    </div>
                </div>
                <AvatarWithPlaceholder
                    avatarUrl={avatarUrl}
                    name={userName || 'User'}
                    size={48}
                    onError={onAvatarUrlNotFound}
                />
            </div>
            <button
                onClick={handleSettingsClick}
                className="absolute top-2 right-2 btn btn-ghost btn-circle btn-xs opacity-60 hover:opacity-100"
                aria-label="Settings"
                title="Settings"
            >
                <span className="material-symbols-outlined text-base">settings</span>
            </button>
        </div>
    </div>
    );
};
