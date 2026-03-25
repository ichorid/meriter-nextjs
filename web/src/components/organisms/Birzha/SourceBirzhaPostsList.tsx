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
}: {
  sourceEntityType: 'project' | 'community';
  sourceEntityId: string;
  variant?: 'default' | 'compact';
  enabled?: boolean;
}) {
  const t = useTranslations('birzhaSource');
  const { data, isLoading, isError } = useBirzhaPostsBySource(sourceEntityType, sourceEntityId, {
    enabled,
  });

  if (isLoading) {
    return <p className="text-sm text-base-content/60">{t('postsLoading')}</p>;
  }
  if (isError || !data?.data?.length) {
    return <p className="text-sm text-base-content/50">{t('postsEmpty')}</p>;
  }

  return (
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
  );
}
