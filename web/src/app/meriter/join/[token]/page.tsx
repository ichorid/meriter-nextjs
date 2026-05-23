import { Suspense } from 'react';
import { JoinCommunityPageClient } from '@/app/meriter/communities/[id]/join/JoinCommunityPageClient';
import { metadataTitle } from '@/lib/i18n/metadata-title';

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata() {
  return metadataTitle('metadata.joinCommunity');
}

export default async function CommunityShortInvitePage({ params }: PageProps) {
  const { token } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[40vh] text-base-content/60 text-sm">
          Loading…
        </div>
      }
    >
      <JoinCommunityPageClient pathToken={token} />
    </Suspense>
  );
}
