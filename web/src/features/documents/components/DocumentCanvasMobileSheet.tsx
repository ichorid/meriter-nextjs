'use client';

import { useTranslations } from 'next-intl';
import { History, MessageSquarePlus, MoreHorizontal } from 'lucide-react';
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { Button } from '@/components/ui/shadcn/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import { DocumentProposeComposer } from '@/features/documents/components/DocumentProposeComposer';
import { DocumentVariantVoteForm } from '@/features/documents/components/DocumentVariantVoteForm';
import { trpc } from '@/lib/trpc/client';

export function DocumentCanvasMobileSheet() {
  const focus = useDocumentCanvasFocus();
  const t = useTranslations('pages.documents');
  const tCanvas = useTranslations('pages.documents.canvas');
  const isMobile = !useMediaQuery('(min-width: 1024px)');

  if (!focus || !isMobile) {
    return null;
  }

  const {
    mobileSheet,
    closeMobileSheet,
    focusedBlockId,
    canManageDocument,
    openAdminDialog,
    openMobileSheet,
    documentId,
  } = focus;

  const blockId = focusedBlockId ?? '';
  const block = blockId ? focus.getBlock(blockId) : null;
  const variantsQuery = trpc.documentVariants.listByBlock.useQuery(
    { documentId, blockId },
    { enabled: !!documentId && !!blockId && mobileSheet.kind !== 'closed' },
  );
  const utils = trpc.useUtils();
  const variants = variantsQuery.data ?? [];
  const waveStartMs = block?.currentWaveStartedAt
    ? new Date(block.currentWaveStartedAt).getTime()
    : null;
  const waveEndsAtMs =
    waveStartMs != null && !Number.isNaN(waveStartMs)
      ? waveStartMs + focus.votingDurationHours * 3_600_000
      : null;
  const waveActive =
    waveEndsAtMs != null &&
    waveEndsAtMs > Date.now() &&
    variants.some((v) => v.status === 'open');

  const closeVotingMutation = trpc.documentVariants.closeVotingWaveOnBlock.useMutation({
    onSuccess: async () => {
      focus.addToast(t('closeVotingSuccess'), 'success');
      closeMobileSheet();
      await utils.documents.getById.invalidate({ id: documentId });
      if (blockId) {
        await utils.documentVariants.listByBlock.invalidate({ documentId, blockId });
      }
    },
    onError: (err) => focus.addToast(err.message, 'error'),
  });

  const voteVariant =
    mobileSheet.kind === 'vote'
      ? variantsQuery.data?.find((v) => v.id === mobileSheet.variantId)
      : null;

  const isOpen = mobileSheet.kind !== 'closed';

  const title =
    mobileSheet.kind === 'propose'
      ? tCanvas('sheetPropose')
      : mobileSheet.kind === 'vote'
        ? tCanvas('sheetVote')
        : mobileSheet.kind === 'blockMenu'
          ? tCanvas('sheetBlockActions')
          : undefined;

  return (
    <BottomActionSheet isOpen={isOpen} onClose={closeMobileSheet} title={title}>
      {mobileSheet.kind === 'blockMenu' && blockId ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 justify-start gap-2 rounded-lg"
            onClick={() => {
              closeMobileSheet();
              openMobileSheet({ kind: 'propose' });
            }}
          >
            <MessageSquarePlus size={16} />
            {tCanvas('proposeCta')}
          </Button>
          {canManageDocument ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-10 justify-start gap-2 rounded-lg"
                onClick={() => {
                  closeMobileSheet();
                  openAdminDialog({ kind: 'history', blockId });
                }}
              >
                <History size={16} />
                {t('history')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 justify-start rounded-lg"
                onClick={() => {
                  closeMobileSheet();
                  openAdminDialog({ kind: 'adminOverride', blockId });
                }}
              >
                {t('editor.adminOverride')}
              </Button>
              {waveActive ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start rounded-lg"
                  disabled={closeVotingMutation.isPending}
                  onClick={() =>
                    closeVotingMutation.mutate({ documentId, blockId })
                  }
                >
                  {t('editor.closeVoting')}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {mobileSheet.kind === 'propose' && blockId ? (
        <DocumentProposeComposer
          blockId={blockId}
          showCancel
          onCancel={closeMobileSheet}
          onSuccess={closeMobileSheet}
        />
      ) : null}

      {mobileSheet.kind === 'vote' && blockId && voteVariant ? (
        <DocumentVariantVoteForm
          variantId={mobileSheet.variantId}
          blockId={blockId}
          onSuccess={closeMobileSheet}
        />
      ) : null}
    </BottomActionSheet>
  );
}

/** Mobile-only control to focus block and open action sheet. */
export function DocumentBlockMobileActions({ blockId }: { blockId: string }) {
  const focus = useDocumentCanvasFocus();
  const tCanvas = useTranslations('pages.documents.canvas');
  const isMobile = !useMediaQuery('(min-width: 1024px)');

  if (!focus || !isMobile) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-8 rounded-lg p-0 lg:hidden"
      aria-label={tCanvas('sheetBlockActions')}
      onClick={(e) => {
        e.stopPropagation();
        focus.setFocusedBlockId(blockId);
        focus.openMobileSheet({ kind: 'blockMenu' });
      }}
    >
      <MoreHorizontal size={16} />
    </Button>
  );
}
