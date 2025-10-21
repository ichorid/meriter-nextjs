'use client';

import Page from '@shared/components/page';
import { swr } from '@lib/swr';
import { useEffect, useState } from 'react';
import { HeaderAvatarBalance } from '@shared/components/header-avatar-balance';
import { useRouter } from 'next/navigation';
import {
    telegramGetAvatarLink,
    telegramGetAvatarLinkUpd,
} from '@lib/telegram';
import { MenuBreadcrumbs } from '@shared/components/menu-breadcrumbs';
import { UpdatesFrequency } from '@shared/components/updates-frequency';
import { ThemeToggle } from '@shared/components/theme-toggle';
import { LogoutButton } from '@shared/components/logout-button';

const SettingsPage = () => {
    const router = useRouter();
    const [user] = swr('/api/rest/getme', {});
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');

    useEffect(() => {
        if (!user?.tgUserId && !user.init) {
            router.push('/meriter/login');
        }
    }, [user, user?.init, router]);

    const handleSyncCommunities = async () => {
        setIsSyncing(true);
        setSyncMessage('');
        
        try {
            const response = await fetch('/api/rest/sync-communities', {
                method: 'POST',
                credentials: 'include',
            });
            
            const data = await response.json();
            
            if (data.success) {
                setSyncMessage(`Найдено ${data.count} сообществ!`);
                setTimeout(() => setSyncMessage(''), 3000);
            }
        } catch (error) {
            setSyncMessage('Ошибка синхронизации сообществ');
        } finally {
            setIsSyncing(false);
        }
    };

    if (!user.token) {
        return null; // Loading or not authenticated
    }

    const tgAuthorId = user?.tgUserId;

    return (
        <Page className="settings">
            <HeaderAvatarBalance
                balance1={undefined}
                balance2={undefined}
                avatarUrl={
                    user?.avatarUrl ?? telegramGetAvatarLink(tgAuthorId)
                }
                onAvatarUrlNotFound={() => telegramGetAvatarLinkUpd(tgAuthorId)}
                onClick={() => {
                    router.push('/meriter/home');
                }}
                userName={user?.name || 'User'}
            >
                <MenuBreadcrumbs>
                    <div>Настройки</div>
                </MenuBreadcrumbs>
                <div>
                    <div className="tip">
                        Управляйте настройками вашего профиля
                    </div>
                </div>
            </HeaderAvatarBalance>

            {/* Update Frequency Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">Частота обновлений</h2>
                    <div className="py-2">
                        <UpdatesFrequency />
                    </div>
                </div>
            </div>

            {/* Theme Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">Тема оформления</h2>
                    <div className="py-2 flex items-center gap-4">
                        <span className="text-sm">Переключение темы:</span>
                        <ThemeToggle />
                    </div>
                </div>
            </div>

            {/* Communities Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">Сообщества</h2>
                    <p className="text-sm opacity-70 mb-2">
                        Обновите список ваших сообществ, проверив членство в Telegram группах
                    </p>
                    <div className="py-2">
                        <button 
                            className={`btn btn-primary ${isSyncing ? 'loading' : ''}`}
                            onClick={handleSyncCommunities}
                            disabled={isSyncing}
                        >
                            {isSyncing ? 'Обновление...' : '🔄 Обновить сообщества'}
                        </button>
                        {syncMessage && (
                            <div className={`mt-2 text-sm ${syncMessage.includes('Ошибка') ? 'text-error' : 'text-success'}`}>
                                {syncMessage}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Account Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">Аккаунт</h2>
                    <div className="py-2">
                        <LogoutButton className="btn btn-error" />
                    </div>
                </div>
            </div>
        </Page>
    );
};

export default SettingsPage;

