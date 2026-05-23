import { Suspense } from 'react';
import { JoinCommunityPageClient } from '../JoinCommunityPageClient';
import { metadataTitle } from '@/lib/i18n/metadata-title';

interface PageProps {
  params: Promise<{ id: string; token: string }>;
}

export async function generateMetadata() {
  return metadataTitle('metadata.joinCommunity');
}

export default async function CommunityJoinWithTokenPage({ params }: PageProps) {
  const { id, token } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[40vh] text-base-content/60 text-sm">
          Loading…
        </div>
      }
    >
      <JoinCommunityPageClient communityId={id} pathToken={token} />
    </Suspense>
  );
}
