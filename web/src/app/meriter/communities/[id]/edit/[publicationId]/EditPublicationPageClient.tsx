'use client';

import React from 'react';
import { PublicationCreateForm } from '@/features/publications/components/PublicationCreateForm';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePublication } from '@/hooks/api/usePublications';
import { Loader2 } from 'lucide-react';

function normalizeEntityId(id: string | undefined | null): string | null {
  const trimmed = (id ?? '').trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
  return trimmed;
}

interface EditPublicationPageClientProps {
  communityId: string;
  publicationId: string;
}

export function EditPublicationPageClient({ communityId, publicationId: routePublicationId }: EditPublicationPageClientProps) {
  const router = useRouter();
  const t = useTranslations('publications.create');
  const { isAuthenticated, isLoading: userLoading } = useAuth();

  const normalizedPublicationId = normalizeEntityId(routePublicationId);
  const { data: publication, isLoading: publicationLoading } = usePublication(
    normalizedPublicationId ?? '',
  );

  useEffect(() => {
    if (!userLoading && !isAuthenticated) {
      const returnTo = `/meriter/communities/${communityId}/edit/${routePublicationId}`;
      router.push(`/meriter/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [
    isAuthenticated,
    userLoading,
    router,
    communityId,
    routePublicationId,
  ]);

  if (!isAuthenticated || !communityId || !normalizedPublicationId) {
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
  // The API always returns the id field, so we should always have it.
  if (!publication.id) {
    return (
      <AdaptiveLayout communityId={communityId} stickyHeader={pageHeader}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-base-content/60">
            Cannot edit: publication ID is missing from API response
          </div>
        </div>
      </AdaptiveLayout>
    );
  }
  
  const actualPublicationId = publication.id;

  return (
    <AdaptiveLayout communityId={communityId} stickyHeader={pageHeader}>
      <div className="space-y-6">
        <PublicationCreateForm
          communityId={communityId}
          publicationId={actualPublicationId}
          initialData={publication}
          onSuccess={(pub) => {
            const postIdentifier = pub.slug || pub.id;
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

