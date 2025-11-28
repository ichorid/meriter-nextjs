'use client';

import React from 'react';
import { CommunityForm } from '@/features/communities/components';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function CommunitySettingsPage({ params }: PageProps) {
    const { id } = await params;
    return (
        <AdaptiveLayout communityId={id}>
            <CommunityForm communityId={id} />
        </AdaptiveLayout>
    );
}
