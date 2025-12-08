'use client';

import React from 'react';
import { PublicationCreateForm } from '@/features/publications/components/PublicationCreateForm';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { usePublication } from '@/hooks/api/usePublications';

export default function EditPublicationPage({
  params,
}: {
  params: Promise<{ id: string; publicationId: string }>;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading: userLoading } = useAuth();
  const [communityId, setCommunityId] = React.useState<string>('');
  const [publicationId, setPublicationId] = React.useState<string>('');

  React.useEffect(() => {
    params.then((p) => {
      setCommunityId(p.id);
      setPublicationId(p.publicationId);
    });
  }, [params]);

  const { data: publication, isLoading: publicationLoading } = usePublication(publicationId);

  useEffect(() => {
    if (!userLoading && !isAuthenticated) {
      router.push(`/meriter/login?returnTo=${encodeURIComponent(`/meriter/communities/${communityId}/edit/${publicationId}`)}`);
    }
  }, [isAuthenticated, userLoading, router, communityId, publicationId]);

  if (!isAuthenticated || !communityId || !publicationId) {
    return null;
  }

  if (publicationLoading) {
    return (
      <AdaptiveLayout communityId={communityId}>
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className="text-base-content/60">Loading...</div>
        </div>
      </AdaptiveLayout>
    );
  }

  if (!publication) {
    return (
      <AdaptiveLayout communityId={communityId}>
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className="text-base-content/60">Publication not found</div>
        </div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout communityId={communityId}>
      <div className="flex-1 p-4">
        <PublicationCreateForm
          communityId={communityId}
          publicationId={publicationId}
          initialData={publication}
          onSuccess={(updatedPublicationId) => {
            // Redirect to community page with post parameter in query string
            router.push(`/meriter/communities/${communityId}?post=${updatedPublicationId}`);
          }}
          onCancel={() => {
            router.push(`/meriter/communities/${communityId}`);
          }}
        />
      </div>
    </AdaptiveLayout>
  );
}

