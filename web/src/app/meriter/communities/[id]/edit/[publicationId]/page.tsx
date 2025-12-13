'use client';

import React from 'react';
import { PublicationCreateForm } from '@/features/publications/components/PublicationCreateForm';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePublication } from '@/hooks/api/usePublications';
import { Loader2 } from 'lucide-react';

export default function EditPublicationPage({
  params,
}: {
  params: Promise<{ id: string; publicationId: string }>;
}) {
  const router = useRouter();
  const t = useTranslations('publications.create');
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

  const pageHeader = (
    <PageHeader
      title={t('editTitle') || 'Edit Publication'}
      showBack={true}
      onBack={() => router.push(`/meriter/communities/${communityId}`)}
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

  // Use the actual publication ID from the fetched publication, not the slug from URL
  // The URL parameter might be a slug, but the API needs the actual ID
  const actualPublicationId = publication?.id || publicationId;

  return (
    <AdaptiveLayout communityId={communityId} stickyHeader={pageHeader}>
      <div className="space-y-6">
        <PublicationCreateForm
          communityId={communityId}
          publicationId={actualPublicationId}
          initialData={publication}
          onSuccess={(pub) => {
            const postIdentifier = pub.slug || pub.id;
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

