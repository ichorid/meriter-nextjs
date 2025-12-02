'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CommunityForm } from '@/features/communities/components';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useCanCreateCommunity } from '@/hooks/api/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';

export default function CreateCommunityPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { canCreate, isLoading: permissionLoading } = useCanCreateCommunity();
    const addToast = useToastStore((state) => state.addToast);

    useEffect(() => {
        // Wait for auth and permission checks to complete
        if (authLoading || permissionLoading) {
            return;
        }

        // If user is not authenticated, redirect will be handled by auth middleware
        if (!user) {
            return;
        }

        // If user doesn't have permission, redirect with message
        if (!canCreate) {
            addToast(
                'Only organizers and team leads can create communities. Contact an organizer if you want to create a team.',
                'info'
            );
            router.push('/meriter/communities');
        }
    }, [user, canCreate, authLoading, permissionLoading, router, addToast]);

    // Show loading state while checking permissions
    if (authLoading || permissionLoading) {
        return (
            <AdaptiveLayout>
                <div className="flex-1 flex items-center justify-center p-4">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                </div>
            </AdaptiveLayout>
        );
    }

    // If user doesn't have permission, show nothing (redirect is in progress)
    if (!canCreate) {
        return (
            <AdaptiveLayout>
                <div className="flex-1 flex items-center justify-center p-4">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                </div>
            </AdaptiveLayout>
        );
    }

    return (
        <AdaptiveLayout>
            <div className="flex-1 p-4">
                <CommunityForm />
            </div>
        </AdaptiveLayout>
    );
}
