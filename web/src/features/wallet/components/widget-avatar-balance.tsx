'use client';

import { classList } from '@lib/classList';

export const WidgetAvatarBalance = ({
    balance1,
    balance2,
    avatarUrl,
    onAvatarUrlNotFound,
    onClick,
}) => (
    <div className="cursor-pointer" onClick={onClick}>
        <div className="bg-base-100 shadow-md rounded-2xl p-4 flex items-center gap-3">
            <div className="flex-1 text-right text-sm">
                {balance1 && (
                    <div className="flex items-center justify-end gap-1 mb-1">
                        {balance1.icon && <span className="text-xs opacity-60">Баланс: </span>}
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
            <div className="avatar">
                <div className="w-12 h-12 rounded-full">
                    <img src={avatarUrl || undefined} onError={onAvatarUrlNotFound} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                </div>
            </div>
        </div>
    </div>
);
