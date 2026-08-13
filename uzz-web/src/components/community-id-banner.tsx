'use client';

import { config } from '@/config';
import { useUzzCommunityId } from '@/lib/use-uzz-community';

export function CommunityIdBanner() {
  const { communityId, loggedIn, sessionLoading } = useUzzCommunityId();
  if (sessionLoading) return null;
  if (communityId) return null;
  if (!config.defaultCommunityId && !loggedIn) {
    return (
      <div
        role="alert"
        className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-100"
      >
        Не удалось открыть каталог сообщества. Войдите или напишите администратору.
      </div>
    );
  }
  return null;
}
