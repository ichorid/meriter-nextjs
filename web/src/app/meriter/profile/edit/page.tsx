'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileEditForm } from '@/components/organisms/Profile/ProfileEditForm';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function EditProfilePage() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) {
    return (
      <AdaptiveLayout>
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!user) {
    return (
      <AdaptiveLayout>
        <div className="p-4">
          <p className="text-brand-text-secondary">{t('notFound')}</p>
        </div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout
      stickyHeader={
        <SimpleStickyHeader
          title={tCommon('profile')}
          showBack={true}
          asStickyHeader={true}
        />
      }
    >
      <div className="w-full">
        <ProfileEditForm
          onCancel={() => router.push('/meriter/profile')}
          onSuccess={() => router.push('/meriter/profile')}
        />
      </div>
    </AdaptiveLayout>
  );
}

