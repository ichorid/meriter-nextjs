'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CommunityForm } from '@/features/communities/components';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useCanCreateCommunity } from '@/hooks/api/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';

export default function CreateCommunityPage() {
    const router = useRouter();
    const t = useTranslations('communities.create');
    const { user, isLoading: authLoading } = useAuth();
    const { canCreate, isLoading: permissionLoading } = useCanCreateCommunity();
    const addToast = useToastStore((state) => state.addToast);

    useEffect(() => {
        if (authLoading || permissionLoading) {
            return;
        }

        if (!user) {
            return;
        }

        if (!canCreate) {
            addToast(
                'Only organizers and team leads can create communities. Contact an organizer if you want to create a team.',
                'info'
            );
            router.push('/meriter/communities');
        }
    }, [user, canCreate, authLoading, permissionLoading, router, addToast]);

    if (authLoading || permissionLoading) {
        return (
            <AdaptiveLayout
                stickyHeader={<SimpleStickyHeader title={t('title')} showBack={true} asStickyHeader={true} />}
            >
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                </div>
            </AdaptiveLayout>
        );
    }

    if (!canCreate) {
        return (
            <AdaptiveLayout
                stickyHeader={<SimpleStickyHeader title={t('title')} showBack={true} asStickyHeader={true} />}
            >
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                </div>
            </AdaptiveLayout>
        );
    }

    return (
        <AdaptiveLayout
            stickyHeader={
                <SimpleStickyHeader
                    title={t('title')}
                    showBack={true}
                    onBack={() => router.push('/meriter/communities')}
                    asStickyHeader={true}
                />
            }
        >
            <div className="space-y-6">
                <CommunityForm />
            </div>
        </AdaptiveLayout>
    );
}
