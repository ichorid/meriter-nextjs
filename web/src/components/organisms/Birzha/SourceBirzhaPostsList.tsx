'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PublicationCardComponent as PublicationCard } from '@/components/organisms/Publication';
import { useBirzhaPostsBySource } from '@/hooks/api/useBirzhaSource';
import { useWallets } from '@/hooks/api/useWallet';
import type { FeedItem } from '@meriter/shared-types';

export function SourceBirzhaPostsList({
  sourceEntityType,
  sourceEntityId,
  variant = 'default',
  enabled = true,
  pageSize = 20,
  titleSearch = '',
}: {
  sourceEntityType: 'project' | 'community';
  sourceEntityId: string;
  variant?: 'default' | 'compact';
  enabled?: boolean;
  /** Page list size (default 20; use 100 on dedicated Birzha posts page). */
  pageSize?: number;
  /** Client-side filter on publication title (hub toolbar). */
  titleSearch?: string;
}) {
  const t = useTranslations('birzhaSource');
  const router = useRouter();
  const { data: wallets = [] } = useWallets();
  const { data, isLoading, isError } = useBirzhaPostsBySource(sourceEntityType, sourceEntityId, {
    enabled,
    limit: pageSize,
    skip: 0,
  });

  const birzhaCommunityId = data?.data?.[0]?.communityId;

  const onValueTagClick = useMemo(() => {
    if (!birzhaCommunityId) return undefined;
    return (tag: string) => {
      const params = new URLSearchParams();
      params.set('vt', tag);
      router.push(`/meriter/communities/${birzhaCommunityId}?${params.toString()}`, {
        scroll: false,
      });
    };
  }, [birzhaCommunityId, router]);

  if (isLoading) {
    return <p className="text-sm text-base-content/60">{t('postsLoading')}</p>;
  }
  if (isError || !data?.data?.length) {
    return <p className="text-sm text-base-content/50">{t('postsEmpty')}</p>;
  }

  const q = (titleSearch ?? '').trim().toLowerCase();
  const rows = !q
    ? data.data
    : data.data.filter((pub) => {
        const title = String((pub as { title?: string }).title ?? '').toLowerCase();
        return title.includes(q);
      });

  if (!rows.length) {
    return <p className="text-sm text-base-content/50">{t('postsEmpty')}</p>;
  }

  const total = data.total ?? data.data.length;
  const capped = pageSize < total;
  const walletList = Array.isArray(wallets) ? wallets : [];
  const gapClass = variant === 'compact' ? 'space-y-3' : 'space-y-4';

  return (
    <>
      {capped ? (
        <p className="mb-3 text-xs text-base-content/50">
          {t('postsPagePartial', { shown: data.data.length, total })}
        </p>
      ) : null}
      <div className={gapClass}>
        {rows.map((pub) => (
          <div
            key={pub.id}
            id={`post-${pub.id}`}
            className="rounded-xl transition-all duration-200 hover:shadow-md"
          >
            <PublicationCard
              publication={pub as unknown as FeedItem}
              wallets={walletList}
              showCommunityAvatar={false}
              isSelected={false}
              onCategoryClick={undefined}
              onValueTagClick={onValueTagClick}
            />
          </div>
        ))}
      </div>
    </>
  );
}
