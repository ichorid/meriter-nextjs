'use client';

import { BirzhaPublishShell } from '@/features/tappalka';

interface BirzhaPublishPageClientProps {
  sourceCommunityId: string;
}

export function BirzhaPublishPageClient({ sourceCommunityId }: BirzhaPublishPageClientProps) {
  return (
    <BirzhaPublishShell
      sourceEntityType="community"
      sourceEntityId={sourceCommunityId}
      backPath={`/meriter/communities/${sourceCommunityId}`}
    />
  );
}
