'use client';

import React from 'react';
import { PublicationCreateForm } from '@/features/publications/components/PublicationCreateForm';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function CreatePublicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const t = useTranslations('publications.create');
  const { isAuthenticated, isLoading: userLoading } = useAuth();
  const [communityId, setCommunityId] = React.useState<string>('');

  React.useEffect(() => {
    params.then((p) => setCommunityId(p.id));
  }, [params]);

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
        <PageHeader
          title={t('title')}
          showBack={true}
          onBack={() => router.push(`/meriter/communities/${communityId}`)}
        />
      }
    >
      <div className="space-y-6">
        <PublicationCreateForm
          communityId={communityId}
          onSuccess={(publication) => {
            const postIdentifier = publication.slug || publication.id;
            router.push(`/meriter/communities/${communityId}/posts/${postIdentifier}`);
          }}
          onCancel={() => {
            router.push(`/meriter/communities/${communityId}`);
          }}
        />
      </div>
    </AdaptiveLayout>
  );
}

