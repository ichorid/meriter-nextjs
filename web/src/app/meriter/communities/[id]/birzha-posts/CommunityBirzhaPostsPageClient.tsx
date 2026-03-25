'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { Button } from '@/components/ui/shadcn/button';
import { SourceBirzhaPostsList } from '@/components/organisms/Birzha/SourceBirzhaPostsList';
import { routes } from '@/lib/constants/routes';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 100;

export function CommunityBirzhaPostsPageClient({ communityId }: { communityId: string }) {
  const router = useRouter();
  const t = useTranslations('birzhaSource');
  const { user } = useAuth();
  const backPath = routes.community(communityId);

  const pageHeader = (
    <SimpleStickyHeader
      title={t('postsPageTitle')}
      showBack
      onBack={() => router.push(backPath)}
      asStickyHeader
      showScrollToTop
    />
  );

  return (
    <AdaptiveLayout
      className="birzha-source-posts"
      communityId={communityId}
      myId={user?.id}
      stickyHeader={pageHeader}
    >
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap justify-end gap-3">
          <Button asChild className="rounded-xl bg-green-600 text-white hover:bg-green-600/90">
            <Link href={`/meriter/communities/${communityId}/birzha-publish`}>{t('publishCta')}</Link>
          </Button>
        </div>
        <SourceBirzhaPostsList
          sourceEntityType="community"
          sourceEntityId={communityId}
          variant="default"
          pageSize={PAGE_SIZE}
        />
      </div>
    </AdaptiveLayout>
  );
}
