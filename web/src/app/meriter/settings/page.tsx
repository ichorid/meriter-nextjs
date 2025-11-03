'use client';

import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useWallets } from '@/hooks/api';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UpdatesFrequency } from '@shared/components/updates-frequency';
import { ThemeToggle } from '@shared/components/theme-toggle';
import { LogoutButton } from '@/components/LogoutButton';
import { LanguageSelector } from '@shared/components/language-selector';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useSyncCommunities } from '@/hooks/api/useCommunities';
import { isFakeDataMode } from '@/config';
import { publicationsApiV1 } from '@/lib/api/v1';

const SettingsPage = () => {
    const router = useRouter();
    const t = useTranslations('settings');
    const tCommon = useTranslations('common');
    
    // Use centralized auth context
    const { user, isLoading, isAuthenticated } = useAuth();
    const { data: wallets = [] } = useWallets();
    const syncCommunitiesMutation = useSyncCommunities();
    const [syncMessage, setSyncMessage] = useState('');
    const activeCommentHook = useState<string | null>(null);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
    
    // Fake data generation state
    const fakeDataMode = isFakeDataMode();
    const [generatingUserPosts, setGeneratingUserPosts] = useState(false);
    const [generatingBeneficiaryPosts, setGeneratingBeneficiaryPosts] = useState(false);
    const [fakeDataMessage, setFakeDataMessage] = useState('');

    // Redirect if not authenticated
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/meriter/login?returnTo=' + encodeURIComponent(window.location.pathname));
        }
    }, [isAuthenticated, isLoading, router]);

    const handleSyncCommunities = async () => {
        setSyncMessage('');
        
        try {
            const result = await syncCommunitiesMutation.mutateAsync();
            setSyncMessage(t('syncSuccess', { count: result.syncedCount }));
            setTimeout(() => setSyncMessage(''), 3000);
        } catch (error) {
            console.error('Sync communities error:', error);
            setSyncMessage(t('syncError'));
        }
    };

    const handleGenerateUserPosts = async () => {
        setGeneratingUserPosts(true);
        setFakeDataMessage('');
        
        try {
            const result = await publicationsApiV1.generateFakeData('user');
            setFakeDataMessage(`Successfully created ${result.count} user post(s)`);
            setTimeout(() => setFakeDataMessage(''), 3000);
        } catch (error) {
            console.error('Generate user posts error:', error);
            setFakeDataMessage('Failed to generate user posts');
            setTimeout(() => setFakeDataMessage(''), 3000);
        } finally {
            setGeneratingUserPosts(false);
        }
    };

    const handleGenerateBeneficiaryPosts = async () => {
        setGeneratingBeneficiaryPosts(true);
        setFakeDataMessage('');
        
        try {
            const result = await publicationsApiV1.generateFakeData('beneficiary');
            setFakeDataMessage(`Successfully created ${result.count} post(s) with beneficiary`);
            setTimeout(() => setFakeDataMessage(''), 3000);
        } catch (error) {
            console.error('Generate beneficiary posts error:', error);
            setFakeDataMessage('Failed to generate posts with beneficiary');
            setTimeout(() => setFakeDataMessage(''), 3000);
        } finally {
            setGeneratingBeneficiaryPosts(false);
        }
    };

    // Show loading state while checking authentication
    if (isLoading) {
        return (
            <AdaptiveLayout className="settings">
                <div className="flex justify-center items-center min-h-[400px]">
                    <div className="loading loading-spinner loading-lg"></div>
                </div>
            </AdaptiveLayout>
        );
    }

    // Don't render if not authenticated (will redirect)
    if (!isAuthenticated || !user) {
        return null;
    }

    return (
        <AdaptiveLayout 
            className="settings"
            activeCommentHook={activeCommentHook}
            activeSlider={activeSlider}
            setActiveSlider={setActiveSlider}
            activeWithdrawPost={activeWithdrawPost}
            setActiveWithdrawPost={setActiveWithdrawPost}
            wallets={Array.isArray(wallets) ? wallets : []}
            myId={user?.id}
        >
            <div className="mb-6">
                <div className="tip">
                    {t('subtitle')}
                </div>
            </div>

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
                            className={`btn btn-primary ${syncCommunitiesMutation.isPending ? 'loading' : ''}`}
                            onClick={handleSyncCommunities}
                            disabled={syncCommunitiesMutation.isPending}
                        >
                            {syncCommunitiesMutation.isPending ? t('syncing') : t('syncCommunities')}
                        </button>
                        {syncMessage && (
                            <div className={`mt-2 text-sm ${syncMessage.includes(t('syncError')) ? 'text-error' : 'text-success'}`}>
                                {syncMessage}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Development Section - Only shown in fake mode */}
            {fakeDataMode && (
                <div className="card bg-base-100 shadow-xl mb-6">
                    <div className="card-body">
                        <h2 className="card-title">Development</h2>
                        <p className="text-sm opacity-70 mb-2">
                            Generate fake data for testing
                        </p>
                        <div className="py-2 space-y-2">
                            <button 
                                className={`btn btn-primary w-full ${generatingUserPosts ? 'loading' : ''}`}
                                onClick={handleGenerateUserPosts}
                                disabled={generatingUserPosts || generatingBeneficiaryPosts}
                            >
                                {generatingUserPosts ? 'Generating...' : 'Generate User Posts'}
                            </button>
                            <button 
                                className={`btn btn-secondary w-full ${generatingBeneficiaryPosts ? 'loading' : ''}`}
                                onClick={handleGenerateBeneficiaryPosts}
                                disabled={generatingUserPosts || generatingBeneficiaryPosts}
                            >
                                {generatingBeneficiaryPosts ? 'Generating...' : 'Generate Posts with Beneficiary'}
                            </button>
                            {fakeDataMessage && (
                                <div className={`mt-2 text-sm ${fakeDataMessage.includes('Failed') ? 'text-error' : 'text-success'}`}>
                                    {fakeDataMessage}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Account Section */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body">
                    <h2 className="card-title">{t('account')}</h2>
                    <div className="py-2">
                        <LogoutButton />
                    </div>
                </div>
            </div>
        </AdaptiveLayout>
    );
};

export default SettingsPage;

