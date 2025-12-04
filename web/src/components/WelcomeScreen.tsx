/**
 * Welcome Screen Component
 * 
 * Displayed after successful authentication for new users
 * Guides them to complete their profile
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BrandButton, Logo } from '@/components/ui';

interface WelcomeScreenProps {
  className?: string;
}

export function WelcomeScreen({ className = '' }: WelcomeScreenProps) {
  const router = useRouter();
  const t = useTranslations('login');

  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <div>
        <div className="text-center mt-8 mb-24">
          <h1 className="text-xl font-normal text-base-content flex justify-center items-center gap-4">
            <Logo size={40} className="text-base-content" />
            <span>{t('siteTitle')}</span>
          </h1>
        </div>
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-base-content text-left mb-6">{t('welcome')}</h2>
          <p className="text-sm text-base-content/70 mb-8">{t('welcomeSubtitle')}</p>
        </div>
        <div className="mb-4">
          <BrandButton
            size="md"
            fullWidth
            variant="default"
            onClick={() => router.push('/meriter/new-user')}
          >
            {t('fillProfile')}
          </BrandButton>
        </div>
      </div>
    </div>
  );
}
