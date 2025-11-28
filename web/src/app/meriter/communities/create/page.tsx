'use client';

import React from 'react';
import { CommunityForm } from '@/features/communities/components';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
export default function CreateCommunityPage() {
    return (
        <AdaptiveLayout>
            <div className="flex-1 p-4">
                <CommunityForm />
            </div>
        </AdaptiveLayout>
    );
}
