'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { canUseWalletForVoting } from '@/components/organisms/VotingPopup/voting-utils';
import { DocumentBlockEditor } from '@/features/documents/components/DocumentBlockEditor';
import { DocumentProposeCommentDialog } from '@/features/documents/components/DocumentProposeCommentDialog';
import { DocumentVariantReferencesEditor } from '@/features/documents/components/DocumentVariantReferencesEditor';
import { normalizeOfficialContentForDisplay } from '@/features/documents/lib/block-content-format';
import type { MeriterBlockType } from '@/features/documents/types/document-block';
import {
  MAX_VARIANT_HTML_LENGTH,
  canAffordVariantProposal,
  computeVariantProposalFeeSplit,
  isEmptyTipTapHtml,
} from '@/features/documents/lib/document-canvas-shared';
import {
  referencesForPropose,
  validateReferenceDrafts,
  type DocumentVariantReferenceDraft,
} from '@/features/documents/types/document-variant-reference';
import { useDocumentCanvasFocusRequired } from '@/features/documents/context/DocumentCanvasFocusContext';

export interface DocumentProposeComposerProps {
  blockId: string;
  blockType?: MeriterBlockType | string;
  /** Current official block HTML — preloaded in the editor when proposing an edit. */
  initialContent?: string;
  rangeStart?: number;
  rangeEnd?: number;
  onSuccess?: () => void;
  showCancel?: boolean;
  onCancel?: () => void;
  /** Inline desktop block — show panel title. Mobile sheet supplies its own chrome. */
  showPanelHeader?: boolean;
}

export function DocumentProposeComposer({
  blockId,
  blockType = 'paragraph',
  initialContent = '',
  rangeStart,
  rangeEnd,
  onSuccess,
  showCancel,
  onCancel,
  showPanelHeader = true,
}: DocumentProposeComposerProps) {
  const focus = useDocumentCanvasFocusRequired();
  const t = useTranslations('pages.documents');
  const tCanvas = useTranslations('pages.documents.canvas');
  const utils = trpc.useUtils();

  const normalizedInitial = useMemo(
    () => normalizeOfficialContentForDisplay(blockType, initialContent),
    [blockType, initialContent],
  );

  const proposalBodyRef = useRef(normalizedInitial);
  const [referenceDrafts, setReferenceDrafts] = useState<DocumentVariantReferenceDraft[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [proposeCommentOpen, setProposeCommentOpen] = useState(false);

  const {
    documentId,
    variantCost,
    quotaRemaining,
    globalWalletBalance,
    community,
    addToast,
  } = focus;

  const proposeMutation = trpc.documentVariants.propose.useMutation({
    onSuccess: async () => {
      proposalBodyRef.current = '';
      setReferenceDrafts([]);
      setResetKey((k) => k + 1);
      await utils.documents.getById.invalidate({ id: documentId });
      await utils.documentVariants.listByBlock.invalidate({ documentId, blockId });
      await utils.documentVariants.listByDocument.invalidate({ documentId });
      onSuccess?.();
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const canAfford = useMemo(
    () => canAffordVariantProposal(variantCost, quotaRemaining, globalWalletBalance, community),
    [variantCost, quotaRemaining, globalWalletBalance, community],
  );

  const executePropose = useCallback(
    (proposerComment?: string) => {
      const trimmed = proposalBodyRef.current.trim();
      const refs = referencesForPropose(referenceDrafts);
      const isRange =
        rangeStart !== undefined && rangeEnd !== undefined && rangeEnd > rangeStart;
      proposeMutation.mutate({
        documentId,
        blockId,
        ...(isRange
          ? { rangeStart, rangeEnd, proposedText: trimmed }
          : { content: trimmed }),
        ...(refs.length > 0 ? { references: refs } : {}),
        ...(proposerComment ? { proposerComment } : {}),
      });
      setProposeCommentOpen(false);
    },
    [
      blockId,
      documentId,
      proposeMutation,
      rangeEnd,
      rangeStart,
      referenceDrafts,
    ],
  );

  const submit = useCallback(() => {
    const trimmed = proposalBodyRef.current.trim();
    if (isEmptyTipTapHtml(trimmed)) return;
    if (trimmed.length > MAX_VARIANT_HTML_LENGTH) {
      addToast(t('proposalTooLong', { max: MAX_VARIANT_HTML_LENGTH }), 'error');
      return;
    }
    const refError = validateReferenceDrafts(referenceDrafts);
    if (refError) {
      addToast(t(`references.${refError}`), 'error');
      return;
    }
    if (variantCost > 0) {
      const { quotaAmount, walletAmount } = computeVariantProposalFeeSplit(
        variantCost,
        quotaRemaining,
        community,
      );
      if (walletAmount > 0) {
        if (
          !canUseWalletForVoting(globalWalletBalance, community) ||
          globalWalletBalance < walletAmount
        ) {
          addToast(t('proposeInsufficientPayment', { cost: variantCost }), 'error');
          return;
        }
      }
      if (quotaAmount > quotaRemaining) {
        addToast(t('proposeInsufficientQuota', { cost: variantCost }), 'error');
        return;
      }
    }
    setProposeCommentOpen(true);
  }, [
    blockId,
    documentId,
    rangeStart,
    rangeEnd,
    variantCost,
    quotaRemaining,
    globalWalletBalance,
    community,
    referenceDrafts,
    addToast,
    t,
    proposeMutation,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
      if (e.key === 'Escape' && showCancel && onCancel) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submit, showCancel, onCancel]);

  const submitLabel =
    variantCost > 0
      ? tCanvas('proposeSubmit', { cost: variantCost })
      : tCanvas('proposeSubmitFree');

  return (
    <>
      <DocumentProposeCommentDialog
        open={proposeCommentOpen}
        onOpenChange={setProposeCommentOpen}
        onConfirm={executePropose}
        isPending={proposeMutation.isPending}
      />
      <div className="overflow-hidden rounded-xl border border-primary/25 bg-base-300/[0.06] ring-1 ring-primary/10">
      <div className="space-y-1 border-b border-base-300/30 bg-base-300/[0.08] px-3 py-2.5">
        {showPanelHeader ? (
          <p className="text-xs font-semibold tracking-tight text-base-content/85">
            {tCanvas('proposeCta')}
          </p>
        ) : null}
        {variantCost > 0 ? (
          <p className="text-[11px] leading-snug text-base-content/55">
            {t('proposeCostHint', { cost: variantCost })}
          </p>
        ) : null}
        <p className="text-[10px] text-base-content/45">{tCanvas('proposeShortcut')}</p>
      </div>

      <div className="space-y-3 p-3">
        <DocumentBlockEditor
          key={`propose-${blockId}-${blockType}-${resetKey}`}
          blockType={blockType}
          content={normalizedInitial}
          onChange={(html) => {
            proposalBodyRef.current = html;
          }}
          placeholder={t('proposePlaceholder')}
          disabled={proposeMutation.isPending}
        />
        <DocumentVariantReferencesEditor
          key={`refs-${blockId}-${resetKey}`}
          value={referenceDrafts}
          onChange={setReferenceDrafts}
          disabled={proposeMutation.isPending}
        />
        <div className="flex flex-wrap gap-2 border-t border-base-300/25 pt-3">
          <Button
            type="button"
            size="sm"
            className="rounded-lg"
            disabled={proposeMutation.isPending || !canAfford}
            onClick={submit}
          >
            {submitLabel}
          </Button>
          {showCancel ? (
            <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={onCancel}>
              {tCanvas('proposeCancel')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
    </>
  );
}
