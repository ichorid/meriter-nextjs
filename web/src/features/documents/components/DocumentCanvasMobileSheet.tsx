'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { History, MessageSquarePlus, MoreHorizontal } from 'lucide-react';
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { Button } from '@/components/ui/shadcn/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import { DocumentProposeComposer } from '@/features/documents/components/DocumentProposeComposer';
import { openDocumentVariantVoting } from '@/features/documents/lib/document-variant-voting';
import { trpc } from '@/lib/trpc/client';

export function DocumentCanvasMobileSheet() {
  const focus = useDocumentCanvasFocus();
  const t = useTranslations('pages.documents');
  const tCanvas = useTranslations('pages.documents.canvas');
  const isMobile = !useMediaQuery('(min-width: 1024px)');

  const documentId = focus?.documentId ?? '';
  const blockId = focus?.focusedBlockId ?? '';
  const mobileSheet = focus?.mobileSheet ?? { kind: 'closed' as const };
  const canManageDocument = focus?.canManageDocument ?? false;
  const votingDurationHours = focus?.votingDurationHours ?? 0;
  const block = blockId && focus ? focus.getBlock(blockId) : null;
  const proposalsLocked = block?.proposalsLocked === true;
  const canProposeVariant = !proposalsLocked || canManageDocument;

  const sheetNeedsVariants =
    isMobile &&
    !!focus &&
    mobileSheet.kind !== 'closed' &&
    !!documentId &&
    !!blockId;

  const variantsQuery = trpc.documentVariants.listByBlock.useQuery(
    { documentId, blockId },
    { enabled: sheetNeedsVariants },
  );
  const utils = trpc.useUtils();

  const closeVotingMutation = trpc.documentVariants.closeVotingWaveOnBlock.useMutation({
    onSuccess: async () => {
      focus?.addToast(t('closeVotingSuccess'), 'success');
      focus?.closeMobileSheet();
      await utils.documents.getById.invalidate({ id: documentId });
      if (blockId) {
        await utils.documentVariants.listByBlock.invalidate({ documentId, blockId });
      }
    },
    onError: (err) => focus?.addToast(err.message, 'error'),
  });

  const variants = variantsQuery.data ?? [];
  const waveStartMs = block?.currentWaveStartedAt
    ? new Date(block.currentWaveStartedAt).getTime()
    : null;
  const waveEndsAtMs =
    waveStartMs != null && !Number.isNaN(waveStartMs)
      ? waveStartMs + votingDurationHours * 3_600_000
      : null;
  const waveActive =
    waveEndsAtMs != null &&
    waveEndsAtMs > Date.now() &&
    variants.some((v) => v.status === 'open');

  const voteVariant =
    mobileSheet.kind === 'vote'
      ? variants.find((v) => v.id === mobileSheet.variantId)
      : null;

  const hasBlockMenuContent =
    mobileSheet.kind === 'blockMenu' &&
    !!blockId &&
    (canProposeVariant || proposalsLocked || canManageDocument);

  const hasSheetContent =
    (mobileSheet.kind === 'propose' && !!blockId) ||
    (mobileSheet.kind === 'vote' && !!blockId && !!voteVariant) ||
    hasBlockMenuContent;

  const isOpen =
    isMobile && !!focus && mobileSheet.kind !== 'closed' && hasSheetContent;

  useEffect(() => {
    if (!focus || mobileSheet.kind === 'closed') {
      return;
    }

    if (!isMobile) {
      focus.closeMobileSheet();
      return;
    }

    if (mobileSheet.kind === 'propose' && !blockId) {
      focus.closeMobileSheet();
      return;
    }

    if (mobileSheet.kind === 'blockMenu' && !hasBlockMenuContent) {
      focus.closeMobileSheet();
      return;
    }

    if (mobileSheet.kind === 'vote') {
      if (!blockId) {
        focus.closeMobileSheet();
        return;
      }
      if (!variantsQuery.isLoading && !voteVariant) {
        focus.closeMobileSheet();
      }
    }
  }, [
    focus,
    isMobile,
    mobileSheet,
    blockId,
    hasBlockMenuContent,
    voteVariant,
    variantsQuery.isLoading,
  ]);

  if (!focus || !isMobile) {
    return null;
  }

  if (!isOpen) {
    return null;
  }

  const { closeMobileSheet, openAdminDialog, openMobileSheet } = focus;

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
          {canProposeVariant ? (
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
          ) : proposalsLocked ? (
            <p className="text-sm text-base-content/55">{tCanvas('proposalsLockedHint')}</p>
          ) : null}
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
          blockType={block?.blockType}
          initialContent={block?.officialContent ?? ''}
          showPanelHeader={false}
          showCancel
          onCancel={closeMobileSheet}
          onSuccess={closeMobileSheet}
        />
      ) : null}

      {mobileSheet.kind === 'vote' && blockId && voteVariant ? (
        <Button
          type="button"
          className="h-10 w-full rounded-lg"
          onClick={() => {
            const cid = focus.community?.id ?? '';
            closeMobileSheet();
            if (!cid) return;
            openDocumentVariantVoting({
              variantId: voteVariant.id,
              communityId: cid,
              proposedBy: voteVariant.proposedBy,
              userId: focus.userId,
              docAllowDownvotes: focus.docAllowDownvotes,
              community: focus.community,
            });
          }}
        >
          {tCanvas('sheetVote')}
        </Button>
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
