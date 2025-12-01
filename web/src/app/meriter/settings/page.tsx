'use client';

import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogoutButton } from '@/components/LogoutButton';
import { LanguageSelector } from '@shared/components/language-selector';
import { ThemeSelector } from '@shared/components/theme-selector';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useSyncCommunities } from '@/hooks/api/useCommunities';
import { isFakeDataMode } from '@/config';
import { communitiesApiV1 } from '@/lib/api/v1';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandButton } from '@/components/ui/BrandButton';
import { Loader2 } from 'lucide-react';
import { SuperadminManagement } from '@/components/settings/SuperadminManagement';

const SettingsPage = () => {
    const router = useRouter();
    const t = useTranslations('settings');
    const { user, isLoading, isAuthenticated } = useAuth();
    const syncCommunitiesMutation = useSyncCommunities();
    const [syncMessage, setSyncMessage] = useState('');

    const fakeDataMode = isFakeDataMode();
    const [creatingFakeCommunity, setCreatingFakeCommunity] = useState(false);
    const [fakeCommunityMessage, setFakeCommunityMessage] = useState('');
    const [addingToAllCommunities, setAddingToAllCommunities] = useState(false);
    const [addToAllMessage, setAddToAllMessage] = useState('');

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

    const handleCreateFakeCommunity = async () => {
        setCreatingFakeCommunity(true);
        setFakeCommunityMessage('');
        try {
            const community = await communitiesApiV1.createFakeCommunity();
            setFakeCommunityMessage(`Successfully created community: ${community.name}`);
            setTimeout(() => {
                router.push(`/meriter/communities/${community.id}`);
            }, 1000);
        } catch (error) {
            console.error('Create fake community error:', error);
            setFakeCommunityMessage('Failed to create fake community');
            setTimeout(() => setFakeCommunityMessage(''), 3000);
        } finally {
            setCreatingFakeCommunity(false);
        }
    };

    const handleAddToAllCommunities = async () => {
        setAddingToAllCommunities(true);
        setAddToAllMessage('');
        try {
            const result = await communitiesApiV1.addUserToAllCommunities();
            if (result.errors && result.errors.length > 0) {
                setAddToAllMessage(`Added to ${result.added} communities, skipped ${result.skipped}. ${result.errors.length} errors occurred.`);
            } else {
                setAddToAllMessage(`Successfully added to ${result.added} communities (${result.skipped} already members)`);
            }
            setTimeout(() => setAddToAllMessage(''), 5000);
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            console.error('Add to all communities error:', error);
            setAddToAllMessage('Failed to add user to all communities');
            setTimeout(() => setAddToAllMessage(''), 3000);
        } finally {
            setAddingToAllCommunities(false);
        }
    };

    if (isLoading) {
        return (
            <AdaptiveLayout>
                <div className="flex justify-center items-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                </div>
            </AdaptiveLayout>
        );
    }

    if (!isAuthenticated || !user) {
        return null;
    }

    return (
        <AdaptiveLayout>
            <div className="flex flex-col min-h-screen bg-base-100">
                <PageHeader title={t('title')} showBack={true} />

                <div className="p-4 space-y-6">
                    {/* Language Section */}
                    <div className="space-y-3">
                        <h2 className="text-base font-semibold text-brand-text-primary dark:text-base-content">
                            {t('languageSection')}
                        </h2>
                        <LanguageSelector />
                    </div>

                    {/* Theme Section */}
                    <div className="space-y-3">
                        <h2 className="text-base font-semibold text-brand-text-primary dark:text-base-content">
                            {t('themeSection')}
                        </h2>
                        <ThemeSelector />
                    </div>

                    {/* Communities Section */}
                    <div className="space-y-3">
                        <h2 className="text-base font-semibold text-brand-text-primary dark:text-base-content">
                            {t('communities')}
                        </h2>
                        <BrandButton
                            variant="primary"
                            size="md"
                            onClick={handleSyncCommunities}
                            isLoading={syncCommunitiesMutation.isPending}
                            disabled={syncCommunitiesMutation.isPending}
                        >
                            {syncCommunitiesMutation.isPending ? t('syncing') : t('syncCommunities')}
                        </BrandButton>
                        {syncMessage && (
                            <p className={`text-sm ${syncMessage.includes(t('syncError')) ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {syncMessage}
                            </p>
                        )}
                    </div>

                    {/* Development Section (Fake Data Mode) */}
                    {fakeDataMode && (
                        <div className="space-y-3">
                            <h2 className="text-base font-semibold text-brand-text-primary dark:text-base-content">
                                Development
                            </h2>
                            <div className="space-y-2">
                                <BrandButton
                                    variant="primary"
                                    size="md"
                                    onClick={handleCreateFakeCommunity}
                                    isLoading={creatingFakeCommunity}
                                    disabled={creatingFakeCommunity || addingToAllCommunities}
                                    fullWidth
                                >
                                    {creatingFakeCommunity ? 'Creating...' : 'Create Fake Community'}
                                </BrandButton>
                                <BrandButton
                                    variant="outline"
                                    size="md"
                                    onClick={handleAddToAllCommunities}
                                    isLoading={addingToAllCommunities}
                                    disabled={creatingFakeCommunity || addingToAllCommunities}
                                    fullWidth
                                >
                                    {addingToAllCommunities ? 'Adding...' : 'Add This User to All Communities'}
                                </BrandButton>
                                {fakeCommunityMessage && (
                                    <p className={`text-sm ${fakeCommunityMessage.includes('Failed') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        {fakeCommunityMessage}
                                    </p>
                                )}
                                {addToAllMessage && (
                                    <p className={`text-sm ${addToAllMessage.includes('Failed') || addToAllMessage.includes('errors') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        {addToAllMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Superadmin Section */}
                    {user.globalRole === 'superadmin' && (
                        <SuperadminManagement />
                    )}

                    {/* Account Section */}
                    <div className="space-y-3">
                        <h2 className="text-base font-semibold text-brand-text-primary dark:text-base-content">
                            {t('account')}
                        </h2>
                        <LogoutButton />
                    </div>
                </div>
            </div>
        </AdaptiveLayout>
    );
};

export default SettingsPage;
