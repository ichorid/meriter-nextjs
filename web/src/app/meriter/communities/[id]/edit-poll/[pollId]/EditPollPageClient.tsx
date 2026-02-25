'use client';

import React from 'react';
import { FormPollCreate } from '@/features/polls/components/form-poll-create';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePoll } from '@/hooks/api/usePolls';
import { Loader2 } from 'lucide-react';

interface EditPollPageClientProps {
  communityId: string;
  pollId: string;
}

export function EditPollPageClient({ communityId, pollId }: EditPollPageClientProps) {
  const router = useRouter();
  const t = useTranslations('polls');
  const { isAuthenticated, isLoading: userLoading } = useAuth();

  const { data: poll, isLoading: pollLoading } = usePoll(pollId);

  useEffect(() => {
    if (!userLoading && !isAuthenticated) {
      router.push(`/meriter/login?returnTo=${encodeURIComponent(`/meriter/communities/${communityId}/edit-poll/${pollId}`)}`);
    }
  }, [isAuthenticated, userLoading, router, communityId, pollId]);

  if (!isAuthenticated || !communityId || !pollId) {
    return null;
  }

  const pageHeader = (
    <SimpleStickyHeader
      title={t('editTitle')}
      showBack={true}
      onBack={() => router.push(`/meriter/communities/${communityId}`)}
      asStickyHeader={true}
    />
  );

  if (pollLoading) {
    return (
      <AdaptiveLayout communityId={communityId} stickyHeader={pageHeader}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!poll) {
    return (
      <AdaptiveLayout communityId={communityId} stickyHeader={pageHeader}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-base-content/60">Poll not found</div>
        </div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout communityId={communityId} stickyHeader={pageHeader}>
      <div className="space-y-6">
        <FormPollCreate
          communityId={communityId}
          pollId={pollId}
          initialData={poll}
          onSuccess={(updatedPollId) => {
            router.push(`/meriter/communities/${communityId}?poll=${updatedPollId}`);
          }}
          onCancel={() => {
            router.push(`/meriter/communities/${communityId}`);
          }}
        />
      </div>
    </AdaptiveLayout>
  );
}

