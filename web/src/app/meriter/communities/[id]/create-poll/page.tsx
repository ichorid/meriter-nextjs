'use client';

import React from 'react';
import { FormPollCreate } from '@/features/polls/components/form-poll-create';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function CreatePollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const t = useTranslations('polls');
  const { isAuthenticated, isLoading: userLoading } = useAuth();
  const [communityId, setCommunityId] = React.useState<string>('');

  React.useEffect(() => {
    params.then((p) => setCommunityId(p.id));
  }, [params]);

  useEffect(() => {
    if (!userLoading && !isAuthenticated) {
      router.push(`/meriter/login?returnTo=${encodeURIComponent(`/meriter/communities/${communityId}/create-poll`)}`);
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
          title={t('createTitle')}
          showBack={true}
          onBack={() => router.push(`/meriter/communities/${communityId}`)}
        />
      }
    >
      <div className="space-y-6">
        <FormPollCreate
          communityId={communityId}
          onSuccess={(pollId) => {
            router.push(`/meriter/communities/${communityId}?poll=${pollId}`);
          }}
          onCancel={() => {
            router.push(`/meriter/communities/${communityId}`);
          }}
        />
      </div>
    </AdaptiveLayout>
  );
}

