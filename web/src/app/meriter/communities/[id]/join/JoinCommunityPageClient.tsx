'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import { trpc } from '@/lib/trpc/client';
import { safeMeriterReturnPath } from '@/lib/utils/safe-return-to';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';

interface JoinCommunityPageClientProps {
  communityId: string;
}

export function JoinCommunityPageClient({ communityId }: JoinCommunityPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const t = useTranslations('pages.communities.members.invite');
  const token = searchParams?.get('t')?.trim() ?? '';
  const [error, setError] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  const utils = trpc.useUtils();
  const acceptMutation = trpc.communities.acceptCommunityInvite.useMutation({
    onSuccess: async (data) => {
      await Promise.all([
        utils.communities.getById.invalidate({ id: data.communityId }),
        utils.communities.getMembers.invalidate({ id: data.communityId }),
        utils.communities.getAll.invalidate(),
      ]);
      router.replace(routes.community(data.communityId));
    },
    onError: (e) => {
      const m = (e.message ?? '').toLowerCase();
      if (m.includes('already') && m.includes('member')) {
        void utils.communities.getById.invalidate({ id: communityId });
        router.replace(routes.community(communityId));
        return;
      }
      setError(e.message || t('acceptFailed'));
    },
  });

  useEffect(() => {
    if (!token) {
      setError(t('missingToken'));
      return;
    }
    if (authLoading) return;
    if (!user) {
      const joinPath = `${routes.communityJoin(communityId)}?t=${encodeURIComponent(token)}`;
      const safe = safeMeriterReturnPath(joinPath);
      if (safe) {
        router.replace(`/meriter/login?returnTo=${encodeURIComponent(safe)}`);
      } else {
        router.replace(routes.login);
      }
      return;
    }
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    acceptMutation.mutate({ token, expectedCommunityId: communityId });
    // t / acceptMutation: stable enough; avoid re-accept on unrelated renders
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [token, user?.id, authLoading, communityId, router]);

  const stickyHeader = (
    <SimpleStickyHeader
      title={t('pageTitle')}
      showBack={true}
      onBack={() => router.push(routes.community(communityId))}
      asStickyHeader={true}
      showScrollToTop={false}
    />
  );

  if (error) {
    return (
      <AdaptiveLayout
        className="members"
        communityId={communityId}
        myId={user?.id}
        stickyHeader={stickyHeader}
      >
        <div className="max-w-md mx-auto px-4 py-8 text-center space-y-4">
          <p className="text-base-content/80">{error}</p>
          <button
            type="button"
            className="text-primary font-medium hover:underline"
            onClick={() => router.replace(routes.community(communityId))}
          >
            {t('goToCommunity')}
          </button>
        </div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout
      className="members"
      communityId={communityId}
      myId={user?.id}
      stickyHeader={stickyHeader}
    >
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 px-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-base-content/70">{t('joining')}</p>
      </div>
    </AdaptiveLayout>
  );
}
