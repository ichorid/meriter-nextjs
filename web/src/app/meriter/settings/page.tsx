'use client';

import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useWallets } from '@/hooks/api';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UpdatesFrequency } from '@shared/components/updates-frequency';
import { LogoutButton } from '@/components/LogoutButton';
import { LanguageSelector } from '@shared/components/language-selector';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useSyncCommunities } from '@/hooks/api/useCommunities';
import { isFakeDataMode } from '@/config';
import { communitiesApiV1 } from '@/lib/api/v1';
// Gluestack UI components
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Center } from '@/components/ui/center';

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
    
    // Fake community creation state
    const fakeDataMode = isFakeDataMode();
    const [creatingFakeCommunity, setCreatingFakeCommunity] = useState(false);
    const [fakeCommunityMessage, setFakeCommunityMessage] = useState('');
    const [addingToAllCommunities, setAddingToAllCommunities] = useState(false);
    const [addToAllMessage, setAddToAllMessage] = useState('');

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

    const handleCreateFakeCommunity = async () => {
        setCreatingFakeCommunity(true);
        setFakeCommunityMessage('');
        
        try {
            const community = await communitiesApiV1.createFakeCommunity();
            setFakeCommunityMessage(`Successfully created community: ${community.name}`);
            // Redirect to the new community
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
            // Refresh the page to show updated communities
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

    // Show loading state while checking authentication
    if (isLoading) {
        return (
            <AdaptiveLayout
                activeCommentHook={activeCommentHook}
                activeSlider={activeSlider}
                setActiveSlider={setActiveSlider}
                activeWithdrawPost={activeWithdrawPost}
                setActiveWithdrawPost={setActiveWithdrawPost}
                wallets={Array.isArray(wallets) ? wallets : []}
                myId={user?.id}
            >
                <Center minHeight={400}>
                    <Spinner size="large" />
                </Center>
            </AdaptiveLayout>
        );
    }

    // Don't render if not authenticated (will redirect)
    if (!isAuthenticated || !user) {
        return null;
    }

    return (
        <AdaptiveLayout 
            activeCommentHook={activeCommentHook}
            activeSlider={activeSlider}
            setActiveSlider={setActiveSlider}
            activeWithdrawPost={activeWithdrawPost}
            setActiveWithdrawPost={setActiveWithdrawPost}
            wallets={Array.isArray(wallets) ? wallets : []}
            myId={user?.id}
        >
            <VStack space="lg" flex={1}>
                {/* Language Section */}
                <Card>
                    <CardHeader>
                        <Heading size="lg">{t('languageSection')}</Heading>
                    </CardHeader>
                    <CardBody>
                        <LanguageSelector />
                    </CardBody>
                </Card>

                {/* Update Frequency Section */}
                <Card>
                    <CardHeader>
                        <Heading size="lg">{t('updatesFrequency')}</Heading>
                    </CardHeader>
                    <CardBody>
                        <UpdatesFrequency />
                    </CardBody>
                </Card>

                {/* Communities Section */}
                <Card>
                    <CardHeader>
                        <Heading size="lg">{t('communities')}</Heading>
                    </CardHeader>
                    <CardBody>
                        <VStack space="sm">
                                <Button
                                    variant="solid"
                                    onPress={handleSyncCommunities}
                                    isDisabled={syncCommunitiesMutation.isPending}
                                >
                                    {syncCommunitiesMutation.isPending ? (
                                        <HStack space="sm" alignItems="center">
                                            <Spinner size="small" />
                                            <ButtonText>{t('syncing')}</ButtonText>
                                        </HStack>
                                    ) : (
                                        <ButtonText>{t('syncCommunities')}</ButtonText>
                                    )}
                                </Button>
                                {syncMessage && (
                                    <Text 
                                        size="sm" 
                                        color={syncMessage.includes(t('syncError')) ? '$error500' : '$success500'}
                                    >
                                        {syncMessage}
                                    </Text>
                                )}
                        </VStack>
                    </CardBody>
                </Card>

                {/* Development Section - Only shown in fake mode */}
                {fakeDataMode && (
                    <Card>
                        <CardHeader>
                            <Heading size="lg">Development</Heading>
                        </CardHeader>
                        <CardBody>
                            <VStack space="sm">
                                <Button
                                    variant="solid"
                                    width="100%"
                                    onPress={handleCreateFakeCommunity}
                                    isDisabled={creatingFakeCommunity || addingToAllCommunities}
                                >
                                    {creatingFakeCommunity ? (
                                        <HStack space="sm" alignItems="center">
                                            <Spinner size="small" />
                                            <ButtonText>Creating...</ButtonText>
                                        </HStack>
                                    ) : (
                                        <ButtonText>Create Fake Community</ButtonText>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    width="100%"
                                    onPress={handleAddToAllCommunities}
                                    isDisabled={creatingFakeCommunity || addingToAllCommunities}
                                >
                                    {addingToAllCommunities ? (
                                        <HStack space="sm" alignItems="center">
                                            <Spinner size="small" />
                                            <ButtonText>Adding...</ButtonText>
                                        </HStack>
                                    ) : (
                                        <ButtonText>Add This User to All Communities</ButtonText>
                                    )}
                                </Button>
                                {fakeCommunityMessage && (
                                    <Text 
                                        size="sm" 
                                        color={fakeCommunityMessage.includes('Failed') ? '$error500' : '$success500'}
                                    >
                                        {fakeCommunityMessage}
                                    </Text>
                                )}
                                {addToAllMessage && (
                                    <Text 
                                        size="sm" 
                                        color={addToAllMessage.includes('Failed') || addToAllMessage.includes('errors') ? '$error500' : '$success500'}
                                    >
                                        {addToAllMessage}
                                    </Text>
                                )}
                            </VStack>
                        </CardBody>
                    </Card>
                )}

                {/* Account Section */}
                <Card>
                    <CardHeader>
                        <Heading size="lg">{t('account')}</Heading>
                    </CardHeader>
                    <CardBody>
                        <LogoutButton />
                    </CardBody>
                </Card>
            </VStack>
        </AdaptiveLayout>
    );
};

export default SettingsPage;

