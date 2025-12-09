'use client';

import React from 'react';
import { FormPollCreate } from '@/features/polls/components/form-poll-create';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { usePoll } from '@/hooks/api/usePolls';

export default function EditPollPage({
  params,
}: {
  params: Promise<{ id: string; pollId: string }>;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading: userLoading } = useAuth();
  const [communityId, setCommunityId] = React.useState<string>('');
  const [pollId, setPollId] = React.useState<string>('');

  React.useEffect(() => {
    params.then((p) => {
      setCommunityId(p.id);
      setPollId(p.pollId);
    });
  }, [params]);

  const { data: poll, isLoading: pollLoading } = usePoll(pollId);

  useEffect(() => {
    if (!userLoading && !isAuthenticated) {
      router.push(`/meriter/login?returnTo=${encodeURIComponent(`/meriter/communities/${communityId}/edit-poll/${pollId}`)}`);
    }
  }, [isAuthenticated, userLoading, router, communityId, pollId]);

  if (!isAuthenticated || !communityId || !pollId) {
    return null;
  }

  if (pollLoading) {
    return (
      <AdaptiveLayout communityId={communityId}>
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className="text-base-content/60">Loading...</div>
        </div>
      </AdaptiveLayout>
    );
  }

  if (!poll) {
    return (
      <AdaptiveLayout communityId={communityId}>
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className="text-base-content/60">Poll not found</div>
        </div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout communityId={communityId}>
      <div className="flex-1 p-4">
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

