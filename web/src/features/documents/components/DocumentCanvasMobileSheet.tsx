'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { History, MessageSquarePlus, MoreHorizontal } from 'lucide-react';
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { Button } from '@/components/ui/shadcn/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import { DocumentProposeComposer } from '@/features/documents/components/DocumentProposeComposer';
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
  const canProposeDocumentVariants = focus?.canProposeDocumentVariants ?? false;
  const canViewBlockHistory = Boolean(focus?.userId);
  const canProposeVariant =
    canProposeDocumentVariants && canProposeInThread && (!proposalsLocked || canManageDocument);

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
  const threadsQuery = trpc.documentVariants.listByDocument.useQuery(
    { documentId },
    { enabled: sheetNeedsVariants && !!documentId },
  );
  const variants = variantsQuery.data ?? [];
  const threadForBlock = threadsQuery.data?.threads.find((thread) => thread.blockId === blockId);
  const waveEndsAtMs = threadForBlock?.waveEndsAt
    ? Date.parse(threadForBlock.waveEndsAt)
    : block?.currentWaveStartedAt
      ? new Date(block.currentWaveStartedAt).getTime() + votingDurationHours * 3_600_000
      : null;
  const proposalsOpen = threadForBlock?.proposalsOpen ?? true;
  const waveActive =
    waveEndsAtMs != null &&
    waveEndsAtMs > Date.now() &&
    variants.some((v) => v.status === 'open');
  const canProposeInThread = proposalsOpen && !proposalsLocked;

  const hasBlockMenuContent =
    mobileSheet.kind === 'blockMenu' &&
    !!blockId &&
    (canProposeVariant || proposalsLocked || canManageDocument || canViewBlockHistory);

  const hasSheetContent =
    (mobileSheet.kind === 'propose' && !!blockId) || hasBlockMenuContent;

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
    }
  }, [focus, isMobile, mobileSheet, blockId, hasBlockMenuContent]);

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
          {canViewBlockHistory ? (
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
          ) : null}
          {canManageDocument ? (
            <>
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
                  onClick={() => {
                    closeMobileSheet();
                    openAdminDialog({ kind: 'closeVoting', blockId });
                  }}
                >
                  {t('closeVotingNow')}
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
