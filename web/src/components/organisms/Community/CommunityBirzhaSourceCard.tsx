'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { BirzhaPublishDialog } from '@/components/organisms/Birzha/BirzhaPublishDialog';
import { SourceBirzhaPostsList } from '@/components/organisms/Birzha/SourceBirzhaPostsList';
import { useCommunity } from '@/hooks/api/useCommunities';
import { usePublication } from '@/hooks/api/usePublications';

interface CommunityBirzhaSourceCardProps {
  communityId: string;
  communityName: string;
}

export function CommunityBirzhaSourceCard({
  communityId,
  communityName,
}: CommunityBirzhaSourceCardProps) {
  const t = useTranslations('birzhaSource');
  const [open, setOpen] = useState(false);
  const { data: comm } = useCommunity(communityId);
  const obPostId = comm?.futureVisionPublicationId;
  const { data: obPub } = usePublication(obPostId ?? '');
  const seedValueTags = useMemo(() => {
    const tags = (obPub as { valueTags?: string[] } | undefined)?.valueTags;
    return tags?.filter(Boolean);
  }, [obPub]);

  return (
    <div className="mb-6 rounded-xl border border-base-300 bg-base-200/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-base-content">{t('sectionTitle')}</h3>
        <Button
          type="button"
          size="sm"
          className="rounded-xl bg-green-600 text-white hover:bg-green-600/90"
          onClick={() => setOpen(true)}
        >
          <TrendingUp className="mr-2 h-4 w-4 shrink-0" />
          {t('publishCta')}
        </Button>
      </div>
      <BirzhaPublishDialog
        sourceEntityType="community"
        sourceEntityId={communityId}
        open={open}
        onOpenChange={setOpen}
        displayName={communityName}
        seedValueTags={seedValueTags}
      />
      <SourceBirzhaPostsList
        sourceEntityType="community"
        sourceEntityId={communityId}
        variant="compact"
      />
    </div>
  );
}
