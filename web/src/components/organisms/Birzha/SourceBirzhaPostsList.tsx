'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useBirzhaPostsBySource } from '@/hooks/api/useBirzhaSource';
import { routes } from '@/lib/constants/routes';

export function SourceBirzhaPostsList({
  sourceEntityType,
  sourceEntityId,
  variant = 'default',
  enabled = true,
  pageSize = 20,
}: {
  sourceEntityType: 'project' | 'community';
  sourceEntityId: string;
  variant?: 'default' | 'compact';
  enabled?: boolean;
  /** Page list size (default 20; use 100 on dedicated Birzha posts page). */
  pageSize?: number;
}) {
  const t = useTranslations('birzhaSource');
  const { data, isLoading, isError } = useBirzhaPostsBySource(sourceEntityType, sourceEntityId, {
    enabled,
    limit: pageSize,
    skip: 0,
  });

  if (isLoading) {
    return <p className="text-sm text-base-content/60">{t('postsLoading')}</p>;
  }
  if (isError || !data?.data?.length) {
    return <p className="text-sm text-base-content/50">{t('postsEmpty')}</p>;
  }

  const total = data.total ?? data.data.length;
  const capped = pageSize < total;

  return (
    <>
    {capped ? (
      <p className="mb-3 text-xs text-base-content/50">
        {t('postsPagePartial', { shown: data.data.length, total })}
      </p>
    ) : null}
    <ul className={variant === 'compact' ? 'space-y-2' : 'space-y-3'}>
      {data.data.map((pub) => {
        const href = routes.communityPost(pub.communityId ?? '', pub.slug ?? pub.id);
        const title = pub.title?.trim() ? pub.title : t('untitledPost');
        return (
          <li key={pub.id}>
            <Link
              href={href}
              className="block text-sm font-medium text-primary hover:underline"
            >
              {title}
            </Link>
            {variant === 'default' && pub.metrics?.score != null ? (
              <span className="mt-0.5 block text-xs tabular-nums text-base-content/50">
                {t('scoreLabel', { score: pub.metrics.score })}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
    </>
  );
}
