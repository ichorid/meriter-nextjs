'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { RichTextEditor } from '@/components/molecules/RichTextEditor';
import { canUseWalletForVoting } from '@/components/organisms/VotingPopup/voting-utils';
import { DocumentVariantReferencesEditor } from '@/features/documents/components/DocumentVariantReferencesEditor';
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
  onSuccess?: () => void;
  showCancel?: boolean;
  onCancel?: () => void;
}

export function DocumentProposeComposer({
  blockId,
  onSuccess,
  showCancel,
  onCancel,
}: DocumentProposeComposerProps) {
  const focus = useDocumentCanvasFocusRequired();
  const t = useTranslations('pages.documents');
  const tCanvas = useTranslations('pages.documents.canvas');
  const utils = trpc.useUtils();

  const proposalBodyRef = useRef('');
  const [referenceDrafts, setReferenceDrafts] = useState<DocumentVariantReferenceDraft[]>([]);
  const [resetKey, setResetKey] = useState(0);

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
      onSuccess?.();
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const canAfford = useMemo(
    () => canAffordVariantProposal(variantCost, quotaRemaining, globalWalletBalance, community),
    [variantCost, quotaRemaining, globalWalletBalance, community],
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
    const refs = referencesForPropose(referenceDrafts);
    proposeMutation.mutate({
      documentId,
      blockId,
      content: trimmed,
      ...(refs.length > 0 ? { references: refs } : {}),
    });
  }, [
    blockId,
    documentId,
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
    <div className="space-y-2">
      {variantCost > 0 ? (
        <p className="text-[11px] text-base-content/55">{t('proposeCostHint', { cost: variantCost })}</p>
      ) : null}
      <p className="text-[10px] text-base-content/40">{tCanvas('proposeShortcut')}</p>
      <RichTextEditor
        key={`propose-${blockId}-${resetKey}`}
        content=""
        onChange={(html) => {
          proposalBodyRef.current = html;
        }}
        placeholder={t('proposePlaceholder')}
        editable={!proposeMutation.isPending}
        className="[&_.ProseMirror]:min-h-[100px]"
      />
      <DocumentVariantReferencesEditor
        key={`refs-${blockId}-${resetKey}`}
        value={referenceDrafts}
        onChange={setReferenceDrafts}
        disabled={proposeMutation.isPending}
      />
      <div className="flex flex-wrap gap-2">
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
  );
}
