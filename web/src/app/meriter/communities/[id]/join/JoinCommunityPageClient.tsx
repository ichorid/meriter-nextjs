'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import { trpc } from '@/lib/trpc/client';
import { safeMeriterReturnPath } from '@/lib/utils/safe-return-to';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { Button } from '@/components/ui/shadcn/button';
import { useToastStore } from '@/shared/stores/toast.store';
import { CommunityJoinRequestPanel } from '@/components/molecules/CommunityJoinRequest/CommunityJoinRequestPanel';
import { isLocalMembershipHubCommunity } from '@/lib/constants/birzha-source';

interface JoinCommunityPageClientProps {
  communityId: string;
  /** Token from `/join/[token]` path (preferred over `?t=`). */
  pathToken?: string;
}

export function JoinCommunityPageClient({
  communityId,
  pathToken,
}: JoinCommunityPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const tInvite = useTranslations('pages.communities.members.invite');
  const tJoin = useTranslations('pages.communities.joinCommunity');
  const addToast = useToastStore((s) => s.addToast);
  const token = (pathToken ?? searchParams?.get('t') ?? '').trim();
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: community, isLoading: communityLoading } = trpc.communities.getById.useQuery(
    { id: communityId },
    { enabled: Boolean(communityId) },
  );

  const communityName = useMemo(
    () => community?.name?.trim() || tInvite('unnamedCommunity'),
    [community?.name, tInvite],
  );

  const acceptMutation = trpc.communities.acceptCommunityInvite.useMutation({
    onSuccess: async (data) => {
      await Promise.all([
        utils.communities.getById.invalidate({ id: data.communityId }),
        utils.communities.getMembers.invalidate({ id: data.communityId }),
        utils.communities.getAll.invalidate(),
      ]);
      if (data.pendingApproval) {
        addToast(tInvite('pendingApprovalToast'), 'success');
      }
      router.replace(routes.community(data.communityId));
    },
    onError: (e) => {
      const m = (e.message ?? '').toLowerCase();
      if (m.includes('already') && m.includes('member')) {
        void utils.communities.getById.invalidate({ id: communityId });
        router.replace(routes.community(communityId));
        return;
      }
      setError(e.message || tInvite('acceptFailed'));
    },
  });

  const inviteReturnPath = token
    ? pathToken
      ? routes.communityInviteLink(communityId, token)
      : `${routes.communityJoin(communityId)}?t=${encodeURIComponent(token)}`
    : null;

  useEffect(() => {
    if (!token) return;
    if (authLoading) return;
    if (!user) {
      const safe = inviteReturnPath ? safeMeriterReturnPath(inviteReturnPath) : null;
      if (safe) {
        router.replace(`/meriter/login?returnTo=${encodeURIComponent(safe)}`);
      } else {
        router.replace(routes.login);
      }
    }
  }, [token, user?.id, authLoading, communityId, router, inviteReturnPath]);

  const handleJoin = () => {
    if (!token) return;
    setError(null);
    acceptMutation.mutate({ token, expectedCommunityId: communityId });
  };

  const handleDecline = () => {
    router.replace(routes.community(communityId));
  };

  const stickyHeaderInvite = (
    <SimpleStickyHeader
      title={tInvite('pageTitle')}
      showBack={true}
      onBack={() => router.push(routes.community(communityId))}
      asStickyHeader={true}
      showScrollToTop={false}
    />
  );

  const stickyHeaderJoinRequest = (
    <SimpleStickyHeader
      title={tJoin('dialogTitle')}
      showBack={true}
      onBack={() => router.push(routes.community(communityId))}
      asStickyHeader={true}
      showScrollToTop={false}
    />
  );

  if (!token) {
    if (communityLoading) {
      return (
        <AdaptiveLayout
          className="members"
          communityId={communityId}
          myId={user?.id}
          stickyHeader={stickyHeaderJoinRequest}
        >
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 px-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </AdaptiveLayout>
      );
    }

    const allowsJoinRequest = community ? isLocalMembershipHubCommunity(community) : false;

    return (
      <AdaptiveLayout
        className="members"
        communityId={communityId}
        myId={user?.id}
        stickyHeader={stickyHeaderJoinRequest}
      >
        <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
          {allowsJoinRequest ? (
            <CommunityJoinRequestPanel communityId={communityId} layout="block" />
          ) : (
            <p className="text-center text-base-content/80">{tInvite('missingToken')}</p>
          )}
          <button
            type="button"
            className="text-primary font-medium hover:underline text-center"
            onClick={() => router.replace(routes.community(communityId))}
          >
            {tInvite('goToCommunity')}
          </button>
        </div>
      </AdaptiveLayout>
    );
  }

  if (error) {
    return (
      <AdaptiveLayout
        className="members"
        communityId={communityId}
        myId={user?.id}
        stickyHeader={stickyHeaderInvite}
      >
        <div className="max-w-md mx-auto px-4 py-8 text-center space-y-4">
          <p className="text-base-content/80">{error}</p>
          <button
            type="button"
            className="text-primary font-medium hover:underline"
            onClick={() => router.replace(routes.community(communityId))}
          >
            {tInvite('goToCommunity')}
          </button>
        </div>
      </AdaptiveLayout>
    );
  }

  if (authLoading || !user) {
    return (
      <AdaptiveLayout
        className="members"
        communityId={communityId}
        myId={user?.id}
        stickyHeader={stickyHeaderInvite}
      >
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 px-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-base-content/70">{tInvite('joining')}</p>
        </div>
      </AdaptiveLayout>
    );
  }

  if (communityLoading) {
    return (
      <AdaptiveLayout
        className="members"
        communityId={communityId}
        myId={user?.id}
        stickyHeader={stickyHeaderInvite}
      >
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 px-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout
      className="members"
      communityId={communityId}
      myId={user?.id}
      stickyHeader={stickyHeaderInvite}
    >
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
        <div className="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm dark:border-base-content/15">
          <h2 className="text-lg font-semibold text-base-content">{tInvite('promptTitle')}</h2>
          <p className="mt-3 text-sm leading-relaxed text-base-content/80">
            {tInvite('promptBody', { name: communityName })}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              className="sm:flex-1 gap-2"
              onClick={handleJoin}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : null}
              {acceptMutation.isPending ? tInvite('joiningAction') : tInvite('join')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="sm:flex-1"
              onClick={handleDecline}
              disabled={acceptMutation.isPending}
            >
              {tInvite('decline')}
            </Button>
          </div>
        </div>
      </div>
    </AdaptiveLayout>
  );
}
