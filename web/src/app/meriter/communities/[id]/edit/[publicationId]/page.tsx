'use client';

import React from 'react';
import { PublicationCreateForm } from '@/features/publications/components/PublicationCreateForm';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePublication } from '@/hooks/api/usePublications';
import { Loader2 } from 'lucide-react';

function normalizeEntityId(id: string | undefined | null): string | null {
  const trimmed = (id ?? '').trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
  return trimmed;
}

export default function EditPublicationPage({
  params,
}: {
  params: Promise<{ id: string; publicationId: string }>;
}) {
  const router = useRouter();
  const t = useTranslations('publications.create');
  const { isAuthenticated, isLoading: userLoading } = useAuth();

  const resolvedParams = use(params);
  const communityId = normalizeEntityId(resolvedParams.id);
  const routePublicationId = normalizeEntityId(resolvedParams.publicationId);

  const { data: publication, isLoading: publicationLoading } = usePublication(
    routePublicationId ?? '',
  );

  useEffect(() => {
    if (!userLoading && !isAuthenticated) {
      const returnTo = `/meriter/communities/${resolvedParams.id}/edit/${resolvedParams.publicationId}`;
      router.push(`/meriter/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [
    isAuthenticated,
    userLoading,
    router,
    resolvedParams.id,
    resolvedParams.publicationId,
  ]);

  if (!isAuthenticated || !communityId || !routePublicationId) {
    return null;
  }

  const pageHeader = (
    <SimpleStickyHeader
      title={t('editTitle') || 'Edit Publication'}
      showBack={true}
      onBack={() => router.push(`/meriter/communities/${communityId}`)}
      asStickyHeader={true}
    />
  );

  if (publicationLoading) {
    return (
      <AdaptiveLayout communityId={communityId} stickyHeader={pageHeader}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!publication) {
    return (
      <AdaptiveLayout communityId={communityId} stickyHeader={pageHeader}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-base-content/60">Publication not found</div>
        </div>
      </AdaptiveLayout>
    );
  }

  // IMPORTANT: only use the actual publication ID from the API response.
  // Do not fall back to the URL param; otherwise we can end up calling /publications/undefined.
  const actualPublicationId = normalizeEntityId(publication.id);
  if (!actualPublicationId) {
    return (
      <AdaptiveLayout communityId={communityId} stickyHeader={pageHeader}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-base-content/60">
            Cannot edit: publication ID is missing
          </div>
        </div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout communityId={communityId} stickyHeader={pageHeader}>
      <div className="space-y-6">
        <PublicationCreateForm
          communityId={communityId}
          publicationId={actualPublicationId}
          initialData={publication}
          onSuccess={(pub) => {
            const postIdentifier = pub.slug || pub.id;
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

