'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BrandButton, Logo } from '@/components/ui';

export default function WelcomePage() {
    const router = useRouter();
    const t = useTranslations('login');

    return (
        <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md text-center">
                <div className="flex justify-center mb-8">
                    <Logo size={64} className="text-base-content" />
                </div>
                <h1 className="text-3xl font-bold text-base-content mb-4">{t('welcome')}</h1>
                <p className="text-base-content/70 mb-8">{t('welcomeSubtitle')}</p>

                <BrandButton
                    size="lg"
                    fullWidth
                    onClick={() => router.push('/meriter/new-user')}
                >
                    {t('fillProfile')}
                </BrandButton>
            </div>
        </div>
    );
}
