'use client';

import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogoutBlock } from '@/components/organisms/LogoutBlock';
import { LanguageSelector } from '@shared/components/language-selector';
import { ThemeSelector } from '@shared/components/theme-selector';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { isFakeDataMode } from '@/config';
import { communitiesApiV1 } from '@/lib/api/v1';

import { BrandButton } from '@/components/ui/BrandButton';
import { Loader2 } from 'lucide-react';
import { SuperadminManagement } from '@/components/settings/SuperadminManagement';
import { InviteInput } from '@/components/molecules/InviteInput';

const SettingsPage = () => {
    const router = useRouter();
    const t = useTranslations('settings');
    const { user, isLoading, isAuthenticated } = useAuth();

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

    const handleCreateFakeCommunity = async () => {
        setCreatingFakeCommunity(true);
        setFakeCommunityMessage('');
        try {
            const community = await communitiesApiV1.createFakeCommunity();
            setFakeCommunityMessage(t('fakeCommunityCreated', { name: community.name }));
            setTimeout(() => {
                router.push(`/meriter/communities/${community.id}`);
            }, 1000);
        } catch (error) {
            console.error('Create fake community error:', error);
            setFakeCommunityMessage(t('fakeCommunityFailed'));
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
                setAddToAllMessage(t('addToAllPartial', { added: result.added, skipped: result.skipped, errors: result.errors.length }));
            } else {
                setAddToAllMessage(t('addToAllSuccess', { added: result.added, skipped: result.skipped }));
            }
            setTimeout(() => setAddToAllMessage(''), 5000);
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            console.error('Add to all communities error:', error);
            setAddToAllMessage(t('addToAllFailed'));
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
        <AdaptiveLayout
            stickyHeader={<SimpleStickyHeader title={t('title')} showBack={true} asStickyHeader={true} />}
        >
            <div className="space-y-6">
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

                {/* Invite Section */}
                <div className="space-y-3">
                    <h2 className="text-base font-semibold text-brand-text-primary dark:text-base-content">
                        {t('inviteSection')}
                    </h2>
                    <InviteInput />
                </div>

                {/* Development Section (Fake Data Mode) */}
                {fakeDataMode && (
                    <div className="space-y-3">
                        <h2 className="text-base font-semibold text-brand-text-primary dark:text-base-content">
                            {t('development')}
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
                                {creatingFakeCommunity ? t('creating') : t('createFakeCommunity')}
                            </BrandButton>
                            <BrandButton
                                variant="outline"
                                size="md"
                                onClick={handleAddToAllCommunities}
                                isLoading={addingToAllCommunities}
                                disabled={creatingFakeCommunity || addingToAllCommunities}
                                fullWidth
                            >
                                {addingToAllCommunities ? t('adding') : t('addUserToAllCommunities')}
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

                {/* Account Section - now shared component */}
                <LogoutBlock />
            </div>
        </AdaptiveLayout>
    );
};

export default SettingsPage;
