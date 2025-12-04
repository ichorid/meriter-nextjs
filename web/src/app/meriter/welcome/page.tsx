'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BrandButton, Logo } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function WelcomePage() {
    const router = useRouter();
    const t = useTranslations('login');
    const { user, isLoading: authLoading } = useAuth();

    if (authLoading) {
        return (
            <div className="min-h-screen bg-base-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
        );
    }

    if (!user) {
        router.push('/meriter/login');
        return null;
    }

    return (
        <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md text-center flex flex-col items-center justify-around min-h-[calc(100svh-32px)]">
                <div className="flex justify-center mb-8">
                    <Logo size={64} className="text-base-content" />
                </div>
                <div>
                <h1 className="text-3xl text-left font-bold text-base-content mb-4">{t('welcome')}</h1>
                <p className="text-base-content/70 text-left mb-8">{t('welcomeSubtitle')}</p>
                </div>

                <BrandButton
                    size="sm"
                    variant="default"
                    fullWidth
                    onClick={() => router.push('/meriter/new-user')}
                >
                    {t('fillProfile')}
                </BrandButton>
            </div>
        </div>
    );
}
