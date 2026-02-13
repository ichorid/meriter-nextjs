'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CommunityForm } from '@/features/communities/components';
import { CommunityRulesEditor } from '@/features/communities/components/CommunityRulesEditor';
import { CommentSettingsSection } from '@/features/communities/components/CommentSettingsSection';
import { TappalkaSettingsForm } from '@/features/communities/components/TappalkaSettingsForm';
import { InvestingSettingsForm } from '@/features/communities/components/InvestingSettingsForm';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useCommunity, useUpdateCommunity } from '@/hooks/api/useCommunities';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/shadcn/tabs';

interface CommunitySettingsPageClientProps {
  communityId: string;
}

export function CommunitySettingsPageClient({ communityId }: CommunitySettingsPageClientProps) {
    const router = useRouter();
    const t = useTranslations('pages.communitySettings');
    const tRules = useTranslations('communities.rules');
    const { data: community, isLoading: communityLoading } = useCommunity(communityId);
    const { user } = useAuth();
    const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles(user?.id || '');
    const updateCommunity = useUpdateCommunity();
    const [activeTab, setActiveTab] = useState('general');

    // Check if user is superadmin
    const isSuperadmin = user?.globalRole === 'superadmin';

    // Check if user is lead/admin of this community
    const isUserLead = useMemo(() => {
        if (!communityId || !user?.id || !userRoles) return false;
        const role = userRoles.find((r) => r.communityId === communityId);
        return role?.role === 'lead';
    }, [communityId, user?.id, userRoles]);

    // Check if user has access (superadmin or lead)
    const hasAccess = isSuperadmin || isUserLead;

    // Redirect if no access
    useEffect(() => {
        if (!communityLoading && !rolesLoading && !hasAccess && user) {
            router.push(`/meriter/communities/${communityId}`);
        }
    }, [communityLoading, rolesLoading, hasAccess, user, communityId, router]);

    const handleRulesSave = async (rules: {
        permissionRules?: any;
        meritSettings?: any;
        linkedCurrencies?: string[];
        settings?: {
            dailyEmission?: number;
            postCost?: number;
            pollCost?: number;
            forwardCost?: number;
            editWindowMinutes?: number;
            allowEditByOthers?: boolean;
        };
        votingSettings?: {
            votingRestriction?: 'any' | 'not-same-team';
            currencySource?: 'quota-and-wallet' | 'quota-only' | 'wallet-only';
        };
    }) => {
        await updateCommunity.mutateAsync({
            id: communityId,
            data: rules,
        });
    };

    const handleTappalkaSave = async (data: {
        tappalkaSettings?: any;
    }) => {
        await updateCommunity.mutateAsync({
            id: communityId,
            data,
        });
    };

    const handleCommentSettingsSave = async (data: {
        settings?: { commentMode?: 'all' | 'neutralOnly' | 'weightedOnly' };
    }) => {
        await updateCommunity.mutateAsync({
            id: communityId,
            data,
        });
    };

    const handleInvestingSave = async (data: {
        settings?: {
            investingEnabled?: boolean;
            investorShareMin?: number;
            investorShareMax?: number;
        };
    }) => {
        await updateCommunity.mutateAsync({
            id: communityId,
            data,
        });
    };

    const pageTitle = community?.name
        ? t('settingsTitle', { communityName: community.name })
        : t('settingsTitle', { communityName: '' });

    // Show loading state while checking permissions
    if (communityLoading || rolesLoading || !user) {
        return (
            <AdaptiveLayout
                communityId={communityId}
                stickyHeader={
                    <SimpleStickyHeader
                        title={pageTitle}
                        showBack={true}
                        onBack={() => router.push(`/meriter/communities/${communityId}`)}
                        asStickyHeader={true}
                    />
                }
            >
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                </div>
            </AdaptiveLayout>
        );
    }

    // Show access denied if user doesn't have access
    if (!hasAccess) {
        return (
            <AdaptiveLayout
                communityId={communityId}
                stickyHeader={
                    <SimpleStickyHeader
                        title={pageTitle}
                        showBack={true}
                        onBack={() => router.push(`/meriter/communities/${communityId}`)}
                        asStickyHeader={true}
                    />
                }
            >
                <div className="p-6 bg-base-200 rounded-lg shadow-none">
                    <p className="text-brand-text-primary text-lg font-medium mb-2">
                        Access Restricted
                    </p>
                    <p className="text-brand-text-secondary">
                        Only community leads and superadmins can access community settings.
                    </p>
                </div>
            </AdaptiveLayout>
        );
    }

    if (!community) {
        return (
            <AdaptiveLayout
                communityId={communityId}
                stickyHeader={
                    <SimpleStickyHeader
                        title={pageTitle}
                        showBack={true}
                        onBack={() => router.push(`/meriter/communities/${communityId}`)}
                        asStickyHeader={true}
                    />
                }
            >
                <div className="p-6 bg-base-200 rounded-lg shadow-none">
                    <p className="text-brand-text-primary text-lg font-medium mb-2">
                        Community Not Found
                    </p>
                </div>
            </AdaptiveLayout>
        );
    }

    return (
        <AdaptiveLayout
            communityId={communityId}
            stickyHeader={
                <SimpleStickyHeader
                    title={pageTitle}
                    showBack={true}
                    onBack={() => router.push(`/meriter/communities/${communityId}`)}
                    asStickyHeader={true}
                />
            }
        >
            <div className="space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 bg-base-200 rounded-xl p-1">
                        <TabsTrigger 
                            value="general"
                            className="data-[state=active]:bg-base-100 data-[state=active]:text-brand-primary rounded-lg"
                        >
                            {t('tabs.general') || 'General'}
                        </TabsTrigger>
                        <TabsTrigger 
                            value="rules"
                            className="data-[state=active]:bg-base-100 data-[state=active]:text-brand-primary rounded-lg"
                        >
                            {t('tabs.rules') || tRules('title') || 'Rules'}
                        </TabsTrigger>
                        <TabsTrigger 
                            value="comments"
                            className="data-[state=active]:bg-base-100 data-[state=active]:text-brand-primary rounded-lg"
                        >
                            {t('tabs.comments') || 'Comments'}
                        </TabsTrigger>
                        <TabsTrigger 
                            value="investing"
                            className="data-[state=active]:bg-base-100 data-[state=active]:text-brand-primary rounded-lg"
                        >
                            {t('tabs.investing') || 'Investing'}
                        </TabsTrigger>
                        <TabsTrigger 
                            value="tappalka"
                            className="data-[state=active]:bg-base-100 data-[state=active]:text-brand-primary rounded-lg"
                        >
                            {t('tabs.tappalka') || 'Tappalka'}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="general" className="mt-6">
                        <CommunityForm communityId={communityId} />
                    </TabsContent>
                    <TabsContent value="rules" className="mt-6">
                        <CommunityRulesEditor
                            community={community}
                            onSave={handleRulesSave}
                        />
                    </TabsContent>
                    <TabsContent value="comments" className="mt-6">
                        <CommentSettingsSection
                            community={community}
                            onSave={handleCommentSettingsSave}
                        />
                    </TabsContent>
                    <TabsContent value="investing" className="mt-6">
                        <InvestingSettingsForm
                            community={community}
                            onSave={handleInvestingSave}
                        />
                    </TabsContent>
                    <TabsContent value="tappalka" className="mt-6">
                        <TappalkaSettingsForm
                            community={community}
                            onSave={handleTappalkaSave}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </AdaptiveLayout>
    );
}

