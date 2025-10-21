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
import Link from 'next/link';
import { UpdatesFrequency } from '@shared/components/updates-frequency';
import { ThemeToggle } from '@shared/components/theme-toggle';
import { LogoutButton } from '@shared/components/logout-button';
import { LanguageSelector } from '@shared/components/language-selector';
import { useTranslation } from 'react-i18next';

const SettingsPage = () => {
    const router = useRouter();
    const { t } = useTranslation('settings');
    const [user] = swr('/api/rest/getme', {});
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');

    useEffect(() => {
        if (!user?.tgUserId && !user.init) {
            router.push('/meriter/login?returnTo=' + encodeURIComponent(window.location.pathname));
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
                setSyncMessage(t('syncSuccess', { count: data.count }));
                setTimeout(() => setSyncMessage(''), 3000);
            }
        } catch (error) {
            setSyncMessage(t('syncError'));
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
                <div>
                    <div className="breadcrumbs text-sm mb-2 sm:mb-4">
                        <ul>
                            <li className="flex items-center gap-1">
                                <Link href="/meriter/home" className="link link-hover flex items-center gap-1">
                                    <img
                                        className="w-5 h-5"
                                        src={"/meriter/home.svg"}
                                        alt="Home"
                                    />
                                    <span>{t('breadcrumb', { ns: 'home' })}</span>
                                </Link>
                            </li>
                            <li>{t('breadcrumb')}</li>
                        </ul>
                    </div>
                </div>
                <div>
                    <div className="tip">
                        {t('subtitle')}
                    </div>
                </div>
            </HeaderAvatarBalance>

            {/* Language Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">{t('languageSection')}</h2>
                    <div className="py-2">
                        <LanguageSelector />
                    </div>
                </div>
            </div>

            {/* Update Frequency Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">{t('updatesFrequency')}</h2>
                    <div className="py-2">
                        <UpdatesFrequency />
                    </div>
                </div>
            </div>

            {/* Theme Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">{t('themeSection')}</h2>
                    <div className="py-2 flex items-center gap-4">
                        <span className="text-sm">{t('themeToggle')}</span>
                        <ThemeToggle />
                    </div>
                </div>
            </div>

            {/* Communities Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">{t('communities')}</h2>
                    <p className="text-sm opacity-70 mb-2">
                        {t('communitiesDescription')}
                    </p>
                    <div className="py-2">
                        <button 
                            className={`btn btn-primary ${isSyncing ? 'loading' : ''}`}
                            onClick={handleSyncCommunities}
                            disabled={isSyncing}
                        >
                            {isSyncing ? t('syncing') : t('syncCommunities')}
                        </button>
                        {syncMessage && (
                            <div className={`mt-2 text-sm ${syncMessage.includes(t('syncError')) ? 'text-error' : 'text-success'}`}>
                                {syncMessage}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Account Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">{t('account')}</h2>
                    <div className="py-2">
                        <LogoutButton className="btn btn-error" />
                    </div>
                </div>
            </div>
        </Page>
    );
};

export default SettingsPage;

