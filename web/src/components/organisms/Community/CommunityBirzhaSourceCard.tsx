'use client';

import { useRouter } from 'next/navigation';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { BirzhaSourcePostsEntryRow } from '@/components/organisms/Birzha/BirzhaSourcePostsEntryRow';
import { routes } from '@/lib/constants/routes';
import { useTranslations } from 'next-intl';

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
    <BirzhaSourcePostsEntryRow
      variant="community"
      sourceEntityType="community"
      sourceEntityId={communityId}
      listHref={routes.communityBirzhaPosts(communityId)}
      publishSlot={
        <Button
          type="button"
          className="h-auto min-h-[52px] w-full rounded-xl bg-green-600 px-4 text-white hover:bg-green-600/90 sm:w-auto sm:self-stretch"
          aria-label={`${t('publishCta')}: ${communityName}`}
          onClick={() => router.push(`/meriter/communities/${communityId}/birzha-publish`)}
        >
          <TrendingUp className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          {t('publishCta')}
        </Button>
      }
    />
  );
}
