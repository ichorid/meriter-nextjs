'use client';

import { useRuntimeConfig } from '@/config/runtime-config-context';
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
  const { defaultCommunityId } = useRuntimeConfig();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const needsActive = !me.data?.communityId && !me.isLoading;
  const active = trpc.community.getActive.useQuery(undefined, { enabled: needsActive, retry: false });
  const communityId = me.data?.communityId || active.data?.id || defaultCommunityId;
  const sessionExpired = me.isError && isUnauthorizedError(me.error);
  return {
    communityId,
    communityName: me.data?.communityName ?? active.data?.name ?? null,
    userId: me.data?.id ?? null,
    isUzzAdmin: Boolean(me.data?.isUzzAdmin),
    loggedIn: Boolean(me.data),
    sessionLoading: me.isLoading || (needsActive && active.isLoading),
    sessionExpired,
    sessionUnreachable: me.isError && !sessionExpired,
  };
}
