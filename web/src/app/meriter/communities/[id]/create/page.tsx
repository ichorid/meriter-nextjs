'use client';

import React from 'react';
import { PublicationCreateForm } from '@/features/publications/components/PublicationCreateForm';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CreatePublicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
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
    <AdaptiveLayout communityId={communityId}>
      <div className="flex-1 p-4">
        <PublicationCreateForm
          communityId={communityId}
          onSuccess={(publication) => {
            // Redirect to community page with post parameter in query string
            // Use slug if available, otherwise fall back to id
            const postIdentifier = publication.slug || publication.id;
            router.push(`/meriter/communities/${communityId}?post=${postIdentifier}`);
          }}
          onCancel={() => {
            router.push(`/meriter/communities/${communityId}`);
          }}
        />
      </div>
    </AdaptiveLayout>
  );
}

