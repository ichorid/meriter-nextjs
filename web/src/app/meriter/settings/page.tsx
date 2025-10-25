'use client';

import Page from '@shared/components/page';
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
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

const SettingsPage = () => {
    const router = useRouter();
    const t = useTranslations('settings');
    const tCommon = useTranslations('common');
    
    // Use centralized auth context
    const { user, isLoading, isAuthenticated } = useAuth();
    const queryClient = useQueryClient();
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');

    // Redirect if not authenticated
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/meriter/login?returnTo=' + encodeURIComponent(window.location.pathname));
        }
    }, [isAuthenticated, isLoading, router]);

    const handleSyncCommunities = async () => {
        setIsSyncing(true);
        setSyncMessage('');
        
        try {
            const response = await fetch('/api/v1/communities/sync', {
                method: 'POST',
                credentials: 'include',
            });
            
            const data = await response.json();
            
            if (data.success) {
                setSyncMessage(t('syncSuccess', { count: data.membershipsUpdated }));
                setTimeout(() => setSyncMessage(''), 3000);
                
                // Invalidate SWR cache for communities data to refresh the home page
                // Invalidate React Query caches instead of SWR mutate
                queryClient.invalidateQueries({ queryKey: ['user-communities'] });
                queryClient.invalidateQueries({ queryKey: ['user'] });
            } else {
                setSyncMessage(data.message || t('syncError'));
            }
        } catch (error) {
            console.error('Sync communities error:', error);
            setSyncMessage(t('syncError'));
        } finally {
            setIsSyncing(false);
        }
    };

    // Show loading state while checking authentication
    if (isLoading) {
        return (
            <Page className="settings">
                <div className="flex justify-center items-center min-h-[400px]">
                    <div className="loading loading-spinner loading-lg"></div>
                </div>
            </Page>
        );
    }

    // Don't render if not authenticated (will redirect)
    if (!isAuthenticated || !user) {
        return null;
    }

    const tgAuthorId = user?.externalIds?.telegram;

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
                userName={user?.displayName || 'User'}
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
                                    <span>{tCommon('home')}</span>
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

