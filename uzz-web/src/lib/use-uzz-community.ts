'use client';

import { config } from '@/config';
import { trpc } from '@/lib/trpc/client';
import { isUnauthorizedError } from '@/lib/utils';

export function useUzzCommunityId(): {
  communityId: string;
  communityName: string | null;
  userId: string | null;
  isUzzAdmin: boolean;
  loggedIn: boolean;
  sessionLoading: boolean;
  sessionExpired: boolean;
  sessionUnreachable: boolean;
} {
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const communityId = me.data?.communityId || config.defaultCommunityId;
  const sessionExpired = me.isError && isUnauthorizedError(me.error);
  return {
    communityId,
    communityName: me.data?.communityName ?? null,
    userId: me.data?.id ?? null,
    isUzzAdmin: Boolean(me.data?.isUzzAdmin),
    loggedIn: Boolean(me.data),
    sessionLoading: me.isLoading,
    sessionExpired,
    sessionUnreachable: me.isError && !sessionExpired,
  };
}
