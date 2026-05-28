'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { Button } from '@/components/ui/shadcn/button';
import { SourceBirzhaPostsList } from '@/components/organisms/Birzha/SourceBirzhaPostsList';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 100;

export type BirzhaSourceEntityType = 'community' | 'project';

export interface BirzhaSourcePostsShellProps {
  sourceEntityType: BirzhaSourceEntityType;
  sourceEntityId: string;
  backPath: string;
  publishHref: string;
  variant?: 'page' | 'embedded';
  listTitleSearch?: string;
  /** Hub chrome renders the publish CTA. */
  suppressPublishToolbar?: boolean;
  /** Member/lead or superadmin — default off so embeds never leak the CTA. */
  showPublishCta?: boolean;
}

export function BirzhaSourcePostsShell({
  sourceEntityType,
  sourceEntityId,
  backPath,
  publishHref,
  variant = 'page',
  listTitleSearch = '',
  suppressPublishToolbar = false,
  showPublishCta = false,
}: BirzhaSourcePostsShellProps) {
  const router = useRouter();
  const t = useTranslations('birzhaSource');
  const { user } = useAuth();

  const pageHeader = (
    <SimpleStickyHeader
      title={t('postsPageTitle')}
      showBack
      onBack={() => router.push(backPath)}
      asStickyHeader
      showScrollToTop
    />
  );

  const inner = (
    <div
      className={
        variant === 'embedded'
          ? 'mx-auto w-full max-w-3xl space-y-4 py-2'
          : 'mx-auto w-full max-w-3xl space-y-6 px-4 py-6'
      }
    >
      {!suppressPublishToolbar && showPublishCta ? (
        <div className="flex flex-wrap justify-end gap-3">
          <Button asChild variant="default" size="sm" className="rounded-xl">
            <Link href={publishHref}>{t('publishCta')}</Link>
          </Button>
        </div>
      ) : null}
      <SourceBirzhaPostsList
        sourceEntityType={sourceEntityType}
        sourceEntityId={sourceEntityId}
        variant="default"
        pageSize={PAGE_SIZE}
        titleSearch={listTitleSearch}
      />
    </div>
  );

  if (variant === 'embedded') {
    return inner;
  }

  return (
    <AdaptiveLayout
      className="birzha-source-posts"
      communityId={sourceEntityId}
      myId={user?.id}
      stickyHeader={pageHeader}
    >
      {inner}
    </AdaptiveLayout>
  );
}
