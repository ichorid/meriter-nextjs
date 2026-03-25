'use client';

import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { PublicationCreateForm } from '@/features/publications/components/PublicationCreateForm';
import { Loader2 } from 'lucide-react';

export interface BirzhaPublishDialogProps {
  sourceEntityType: 'project' | 'community';
  sourceEntityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName?: string;
  /** Pre-fill value tags (e.g. from linked “Образ будущего” publication). */
  seedValueTags?: string[];
}

export function BirzhaPublishDialog({
  sourceEntityType,
  sourceEntityId,
  open,
  onOpenChange,
  displayName,
  seedValueTags,
}: BirzhaPublishDialogProps) {
  const t = useTranslations('birzhaSource');
  const { data: birzha, isLoading } = trpc.communities.getBirzhaCommunity.useQuery(undefined, {
    enabled: open,
    staleTime: 120_000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,880px)] w-[min(100vw-1rem,44rem)] max-w-[min(100vw-1rem,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,44rem)]">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle>{t('publishTitle')}</DialogTitle>
          <DialogDescription>
            {displayName
              ? t('publishDescriptionNamed', { name: displayName })
              : t('publishDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!birzha && isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : !birzha ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {t('birzhaCommunityMissing')}
            </p>
          ) : (
            <PublicationCreateForm
              communityId={birzha.id}
              birzhaSourceEntity={{ type: sourceEntityType, id: sourceEntityId }}
              seedValueTags={seedValueTags}
              defaultPostType="basic"
              isProjectCommunity={false}
              onSuccess={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
