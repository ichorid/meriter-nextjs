'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { SourceBirzhaPostsList } from '@/components/organisms/Birzha/SourceBirzhaPostsList';

interface CommunityBirzhaSourceCardProps {
  communityId: string;
  communityName: string;
}

export function CommunityBirzhaSourceCard({
  communityId,
  communityName,
}: CommunityBirzhaSourceCardProps) {
  const t = useTranslations('birzhaSource');
  const router = useRouter();

  return (
    <div className="mb-6 rounded-xl border border-base-300 bg-base-200/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-base-content">{t('sectionTitle')}</h3>
        <Button
          type="button"
          size="sm"
          className="rounded-xl bg-green-600 text-white hover:bg-green-600/90"
          aria-label={`${t('publishCta')}: ${communityName}`}
          onClick={() => router.push(`/meriter/communities/${communityId}/birzha-publish`)}
        >
          <TrendingUp className="mr-2 h-4 w-4 shrink-0" />
          {t('publishCta')}
        </Button>
      </div>
      <SourceBirzhaPostsList
        sourceEntityType="community"
        sourceEntityId={communityId}
        variant="compact"
      />
    </div>
  );
}
