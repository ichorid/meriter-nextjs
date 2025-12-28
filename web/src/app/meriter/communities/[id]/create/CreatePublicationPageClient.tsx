'use client';

import React from 'react';
import { PublicationCreateForm } from '@/features/publications/components/PublicationCreateForm';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { PublicationPostType } from '@/features/publications/components/PublicationCreateForm';

interface CreatePublicationPageClientProps {
  communityId: string;
}

export function CreatePublicationPageClient({ communityId }: CreatePublicationPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('publications.create');
  const { isAuthenticated, isLoading: userLoading } = useAuth();
  
  // Get postType from URL params (e.g., ?postType=project)
  const postTypeParam = searchParams?.get('postType');
  const defaultPostType = (postTypeParam === 'project' || postTypeParam === 'poll' || postTypeParam === 'basic') 
    ? postTypeParam as PublicationPostType 
    : 'basic';

  useEffect(() => {
    if (!userLoading && !isAuthenticated) {
      router.push(`/meriter/login?returnTo=${encodeURIComponent(`/meriter/communities/${communityId}/create`)}`);
    }
  }, [isAuthenticated, userLoading, router, communityId]);

  if (!isAuthenticated || !communityId) {
    return null;
  }

  return (
    <AdaptiveLayout
      communityId={communityId}
      stickyHeader={
        <SimpleStickyHeader
          title={t('title')}
          showBack={true}
          onBack={() => router.push(`/meriter/communities/${communityId}`)}
          asStickyHeader={true}
        />
      }
    >
      <div className="space-y-6">
        <PublicationCreateForm
          communityId={communityId}
          defaultPostType={defaultPostType}
          onSuccess={(publication) => {
            const postIdentifier = publication.slug || publication.id;
            router.push(`/meriter/communities/${communityId}?highlight=${postIdentifier}`);
          }}
          onCancel={() => {
            router.push(`/meriter/communities/${communityId}`);
          }}
        />
      </div>
    </AdaptiveLayout>
  );
}

