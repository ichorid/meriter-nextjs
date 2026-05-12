'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc/client';
import { routes } from '@/lib/constants/routes';

export interface CommunityDocumentsPageClientProps {
  communityId: string;
}

export function CommunityDocumentsPageClient({ communityId }: CommunityDocumentsPageClientProps) {
  const router = useRouter();
  const t = useTranslations('pages.documents');
  const { user, isLoading: authLoading } = useAuth();

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
        {listQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
          </div>
        ) : listQuery.error ? (
          <p className="text-sm text-error">{t('loadError')}</p>
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
