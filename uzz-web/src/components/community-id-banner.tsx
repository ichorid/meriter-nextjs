'use client';

import { config } from '@/config';

export function CommunityIdBanner() {
  if (config.defaultCommunityId) return null;

  return (
    <div
      role="alert"
      className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-100"
    >
      Задайте NEXT_PUBLIC_DEFAULT_COMMUNITY_ID
    </div>
  );
}
