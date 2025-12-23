'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { InviteEntryForm } from '@/components/InviteEntryForm';
import { LoadingState } from '@/components/atoms/LoadingState';

interface InvitePageClientProps {
    params: Promise<{ code: string }>;
}

export function InvitePageClient({ params }: InvitePageClientProps) {
    const router = useRouter();
    const { isAuthenticated, isLoading } = useAuth();
    const resolvedParams = use(params);
    const inviteCode = resolvedParams.code;

    useEffect(() => {
        // If authenticated, redirect to home with invite query parameter
        // InviteHandler on home page will process it automatically
        if (!isLoading && isAuthenticated && inviteCode) {
            router.replace(`/meriter/profile?invite=${encodeURIComponent(inviteCode)}`);
        }
    }, [isAuthenticated, isLoading, inviteCode, router]);

    // Show loading state during auth check
    if (isLoading) {
        return (
            <div className="min-h-screen bg-base-100 px-4 py-8 flex items-center justify-center">
                <LoadingState fullScreen />
            </div>
        );
    }

    // If authenticated, the useEffect will redirect, but show loading in the meantime
    if (isAuthenticated) {
        return (
            <div className="min-h-screen bg-base-100 px-4 py-8 flex items-center justify-center">
                <LoadingState fullScreen />
            </div>
        );
    }

    // If not authenticated, show invite entry form with code pre-filled
    return (
        <div className="min-h-screen bg-base-100 px-4 py-8 flex items-center justify-center">
            <div className="w-full max-w-md">
                <InviteEntryForm inviteCode={inviteCode} />
            </div>
        </div>
    );
}
