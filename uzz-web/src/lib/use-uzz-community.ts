'use client';

import { config } from '@/config';
import { trpc } from '@/lib/trpc/client';

export function useUzzCommunityId(): {
  communityId: string;
  communityName: string | null;
  userId: string | null;
  isUzzAdmin: boolean;
  loggedIn: boolean;
  sessionLoading: boolean;
  sessionError: boolean;
} {
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const communityId = me.data?.communityId || config.defaultCommunityId;
  return {
    communityId,
    communityName: me.data?.communityName ?? null,
    userId: me.data?.id ?? null,
    isUzzAdmin: Boolean(me.data?.isUzzAdmin),
    loggedIn: Boolean(me.data),
    sessionLoading: me.isLoading,
    sessionError: me.isError,
  };
}
