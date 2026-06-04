'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import { cn } from '@/lib/utils';

type CloseMode = 'by_votes' | 'force';
type ForcePick = 'official' | string;

function variantExcerpt(content: string, max = 80): string {
  const plain = blockHtmlToPlainText(content).replace(/\s+/g, ' ').trim();
  if (plain.length <= max) {
    return plain;
  }
  return `${plain.slice(0, max)}…`;
}

export function DocumentCloseVotingDialog() {
  const focus = useDocumentCanvasFocus();
  const t = useTranslations('pages.documents');
  const tCanvas = useTranslations('pages.documents.canvas');
  const utils = trpc.useUtils();

  const [closeMode, setCloseMode] = useState<CloseMode>('by_votes');
  const [forcePick, setForcePick] = useState<ForcePick>('official');

  const blockId =
    focus?.adminDialog.kind === 'closeVoting' ? focus.adminDialog.blockId : null;
  const open = focus?.adminDialog.kind === 'closeVoting' && blockId != null;
  const documentId = focus?.documentId ?? '';

  const block = blockId ? focus?.getBlock(blockId) : null;

  const variantsQuery = trpc.documentVariants.listByBlock.useQuery(
    { documentId, blockId: blockId ?? '' },
    { enabled: open && !!documentId && !!blockId },
  );

  const openVariants = useMemo(
    () => (variantsQuery.data ?? []).filter((v) => v.status === 'open'),
    [variantsQuery.data],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setCloseMode('by_votes');
    setForcePick('official');
  }, [open, blockId]);

  useEffect(() => {
    if (forcePick !== 'official' && !openVariants.some((v) => v.id === forcePick)) {
      setForcePick('official');
    }
  }, [forcePick, openVariants]);

  const closeVotingMutation = trpc.documentVariants.closeVotingWaveOnBlock.useMutation({
    onSuccess: async () => {
      focus?.addToast(t('closeVotingSuccess'), 'success');
      focus?.closeAdminDialog();
      if (blockId) {
        await Promise.all([
          utils.documents.getById.refetch({ id: documentId }),
          utils.documentVariants.listByDocument.refetch({ documentId }),
          utils.documentVariants.listByBlock.refetch({ documentId, blockId }),
          utils.documentVariants.getBlockVotingPanel.refetch({ documentId, blockId }),
          utils.documentVariants.getBlockGovernanceHistory.refetch({ documentId, blockId }),
        ]);
      }
    },
    onError: (err) => focus?.addToast(err.message, 'error'),
  });

  const submit = () => {
    if (!blockId || !documentId) {
      return;
    }
    if (closeMode === 'by_votes') {
      closeVotingMutation.mutate({
        documentId,
        blockId,
        resolution: { mode: 'by_votes' },
      });
      return;
    }
    if (forcePick === 'official') {
      closeVotingMutation.mutate({
        documentId,
        blockId,
        resolution: { mode: 'force_official' },
      });
      return;
    }
    closeVotingMutation.mutate({
      documentId,
      blockId,
      resolution: { mode: 'force_variant', variantId: forcePick },
    });
  };

  if (!focus) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          focus.closeAdminDialog();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('closeVotingDialogTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="leading-relaxed text-base-content/80">{t('closeVotingDialogLead')}</p>
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-base-content/75">
            {t('closeVotingDialogHistoryWarning')}
          </p>

          <fieldset className="space-y-2">
            <label
              className={cn(
                'flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                closeMode === 'by_votes'
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-base-300/50 hover:bg-base-200/40',
              )}
            >
              <input
                type="radio"
                name="close-voting-mode"
                className="mt-1"
                checked={closeMode === 'by_votes'}
                onChange={() => setCloseMode('by_votes')}
              />
              <span>
                <span className="font-medium text-base-content">{t('closeVotingModeByVotes')}</span>
                <span className="mt-0.5 block text-xs text-base-content/60">
                  {t('closeVotingModeByVotesHelp')}
                </span>
              </span>
            </label>

            <label
              className={cn(
                'flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                closeMode === 'force'
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-base-300/50 hover:bg-base-200/40',
              )}
            >
              <input
                type="radio"
                name="close-voting-mode"
                className="mt-1"
                checked={closeMode === 'force'}
                onChange={() => setCloseMode('force')}
              />
              <span>
                <span className="font-medium text-base-content">{t('closeVotingModeForce')}</span>
                <span className="mt-0.5 block text-xs text-base-content/60">
                  {t('closeVotingModeForceHelp')}
                </span>
              </span>
            </label>
          </fieldset>

          {closeMode === 'force' ? (
            <fieldset className="space-y-2 border-t border-base-300/40 pt-3">
              <p className="text-xs font-medium text-base-content/70">
                {t('closeVotingForcePickLabel')}
              </p>

              <label
                className={cn(
                  'flex cursor-pointer gap-3 rounded-lg border px-3 py-2',
                  forcePick === 'official'
                    ? 'border-primary/35 bg-primary/5'
                    : 'border-base-300/40',
                )}
              >
                <input
                  type="radio"
                  name="close-voting-force"
                  checked={forcePick === 'official'}
                  onChange={() => setForcePick('official')}
                />
                <span className="min-w-0">
                  <span className="font-medium">{tCanvas('originalVariant')}</span>
                  {block?.officialContent?.trim() ? (
                    <span className="mt-0.5 block truncate text-xs text-base-content/55">
                      {variantExcerpt(block.officialContent)}
                    </span>
                  ) : null}
                </span>
              </label>

              {openVariants.map((v) => (
                <label
                  key={v.id}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-lg border px-3 py-2',
                    forcePick === v.id
                      ? 'border-primary/35 bg-primary/5'
                      : 'border-base-300/40',
                  )}
                >
                  <input
                    type="radio"
                    name="close-voting-force"
                    checked={forcePick === v.id}
                    onChange={() => setForcePick(v.id)}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{t('statusOpen')}</span>
                    <span className="mt-0.5 block text-xs text-base-content/55">
                      {t('rating', { rating: v.rating ?? 0 })} · {variantExcerpt(v.content)}
                    </span>
                  </span>
                </label>
              ))}

              {openVariants.length === 0 ? (
                <p className="text-xs text-base-content/50">{t('closeVotingNoOpenVariants')}</p>
              ) : null}
            </fieldset>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-lg"
            onClick={() => focus.closeAdminDialog()}
          >
            {t('closeVotingCancel')}
          </Button>
          <Button
            type="button"
            className="rounded-lg"
            disabled={
              closeVotingMutation.isPending ||
              (closeMode === 'force' && forcePick !== 'official' && openVariants.length === 0)
            }
            onClick={submit}
          >
            {t('closeVotingConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
