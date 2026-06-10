'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { trpc } from '@/lib/trpc/client';
import { routes } from '@/lib/constants/routes';
import { Button } from '@/components/ui/shadcn/button';

export interface CommunityDocumentsPageClientProps {
  communityId: string;
}

export function CommunityDocumentsPageClient({ communityId }: CommunityDocumentsPageClientProps) {
  const router = useRouter();
  const t = useTranslations('pages.documents');
  const { user, isLoading: authLoading } = useAuth();
  const { data: roles = [] } = useUserRoles(user?.id ?? '');

  const canManageDocsSettings =
    user?.globalRole === 'superadmin' ||
    roles.some((r) => r?.communityId === communityId && r?.role === 'lead');

  const listQuery = trpc.documents.listByCommunity.useQuery(
    { communityId },
    { enabled: Boolean(communityId && user?.id) },
  );

  const pageHeader = (
    <SimpleStickyHeader
      title={t('listTitle')}
      showBack
      onBack={() => router.push(routes.community(communityId))}
      asStickyHeader
      showScrollToTop
    />
  );

  if (authLoading) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={communityId}
        myId={user?.id}
        stickyHeader={pageHeader}
      >
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!user?.id) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader}>
        <p className="p-4 text-sm text-base-content/70">{t('loginToParticipate')}</p>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout
      className="feed"
      communityId={communityId}
      myId={user.id}
      stickyHeader={pageHeader}
    >
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
        {canManageDocsSettings ? (
          <div className="flex flex-col gap-3 rounded-xl border border-base-300/60 bg-base-200/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-base-content/70">{t('customDocumentsHint')}</p>
            <Button variant="outline" size="sm" className="shrink-0 rounded-xl" asChild>
              <Link href={routes.communitySettings(communityId)}>{t('documentSettingsLink')}</Link>
            </Button>
          </div>
        ) : null}
        {listQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
          </div>
        ) : listQuery.error ? (
          <div className="flex flex-col items-start gap-3 py-6">
            <p className="text-sm text-error">{t('loadError')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => listQuery.refetch()}
            >
              {t('retryLoad')}
            </Button>
          </div>
        ) : !listQuery.data?.length ? (
          <p className="text-sm text-base-content/70">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {listQuery.data.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={routes.communityDocument(communityId, doc.id)}
                  className="flex flex-col rounded-xl border border-base-300 bg-base-200/40 p-4 transition-colors hover:bg-base-300/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium text-base-content">{doc.title}</span>
                  <span className="mt-1 shrink-0 text-sm text-base-content/60 sm:mt-0">
                    {doc.type === 'imageOfFuture'
                      ? t('typeImageOfFuture')
                      : doc.type === 'description'
                        ? t('typeDescription')
                        : t('typeCustom')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdaptiveLayout>
  );
}
