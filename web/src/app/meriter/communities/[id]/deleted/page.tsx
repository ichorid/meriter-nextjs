import { Suspense } from 'react';
import { CommunityDeletedPageClient } from './CommunityDeletedPageClient';

interface CommunityDeletedPageProps {
  params: Promise<{ id: string }>;
}

export default async function CommunityDeletedPage({ params }: CommunityDeletedPageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-base-content/60">
          Loading…
        </div>
      }
    >
      <CommunityDeletedPageClient communityId={id} />
    </Suspense>
  );
}

