'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { useTranslations } from 'next-intl';
import { Pin } from 'lucide-react';
import { DocumentBlockEditor } from '@/features/documents/components/DocumentBlockEditor';
import { getPrimaryDocumentBlock } from '@/features/documents/lib/document-primary-block';
import {
  clearDocumentEditorDraft,
  documentEditorDraftKey,
  readDocumentEditorDraft,
  writeDocumentEditorDraft,
} from '@/features/documents/lib/document-editor-draft';
import {
  canAffordVariantProposal,
  computeVariantProposalFeeSplit,
  isEmptyTipTapHtml,
  MAX_VARIANT_HTML_LENGTH,
} from '@/features/documents/lib/document-canvas-shared';
import { useDocumentCanvasFocusRequired } from '@/features/documents/context/DocumentCanvasFocusContext';
import { canUseWalletForVoting } from '@/components/organisms/VotingPopup/voting-utils';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';

export type GdocsPersistMode = 'propose' | 'official';

export interface DocumentGdocsUnifiedEditorProps {
  documentId: string;
  sections: unknown;
  updatedAt?: string | Date | null;
  canManageDocument: boolean;
  onSynced?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  onPersistModeChange?: (mode: GdocsPersistMode) => void;
  saveRequestRef?: MutableRefObject<(() => void) | null>;
}

export function DocumentGdocsUnifiedEditor({
  documentId,
  sections,
  updatedAt,
  canManageDocument,
  onSynced,
  onDirtyChange,
  onSavingChange,
  onPersistModeChange,
  saveRequestRef,
}: DocumentGdocsUnifiedEditorProps) {
  const t = useTranslations('pages.documents');
  const tGdocs = useTranslations('pages.documents.gdocs');
  const focus = useDocumentCanvasFocusRequired();
  const utils = trpc.useUtils();

  const primaryBlock = useMemo(() => getPrimaryDocumentBlock(sections), [sections]);
  const initialHtml = primaryBlock?.officialHtml ?? '';
  const draftKey = documentEditorDraftKey(documentId, focus.userId);
  const htmlRef = useRef(initialHtml);
  const lastPersistedHtmlRef = useRef(initialHtml);
  const expectedUpdatedAtRef = useRef(updatedAt);
  const loadedDocumentIdRef = useRef<string | null>(null);
  const [editorHtml, setEditorHtml] = useState(initialHtml);
  const [isDirty, setIsDirty] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [persistMode, setPersistMode] = useState<GdocsPersistMode>('propose');

  const effectivePersistMode: GdocsPersistMode = canManageDocument ? persistMode : 'propose';

  useEffect(() => {
    onPersistModeChange?.(effectivePersistMode);
  }, [effectivePersistMode, onPersistModeChange]);

  useEffect(() => {
    expectedUpdatedAtRef.current = updatedAt;
  }, [updatedAt]);

  /** Hydrate editor from session draft or server; never overwrite unsaved local edits on refetch. */
  useEffect(() => {
    const baseline = initialHtml;
    lastPersistedHtmlRef.current = baseline;

    const isNewDocument = loadedDocumentIdRef.current !== documentId;
    if (isNewDocument) {
      loadedDocumentIdRef.current = documentId;
    } else if (isDirty) {
      return;
    }

    const draft = readDocumentEditorDraft(draftKey);
    const html = draft ?? baseline;
    const restored = Boolean(draft && draft.trim() !== baseline.trim());
    htmlRef.current = html;
    setEditorHtml(html);
    setDraftRestored(restored);
    const dirty = html.trim() !== baseline.trim();
    setIsDirty(dirty);
    onDirtyChange?.(dirty);
  }, [documentId, initialHtml, draftKey, isDirty, onDirtyChange]);

  const syncMutation = trpc.documents.syncStructureFromHtml.useMutation({
    onSuccess: async (result) => {
      const serverHtml = getPrimaryDocumentBlock(result.document.sections)?.officialHtml ?? '';
      expectedUpdatedAtRef.current = result.document.updatedAt;
      lastPersistedHtmlRef.current = serverHtml;
      htmlRef.current = serverHtml;
      setEditorHtml(serverHtml);
      setDraftRestored(false);
      clearDocumentEditorDraft(draftKey);
      setIsDirty(false);
      onDirtyChange?.(false);
      utils.documents.getById.setData({ id: documentId }, result.document);
      await utils.documentVariants.listByDocument.invalidate({ documentId });
      focus.addToast(tGdocs('leadEditorSaved'), 'success');
      onSynced?.();
    },
  });

  const proposeMutation = trpc.documentVariants.propose.useMutation({
    onSuccess: async () => {
      lastPersistedHtmlRef.current = htmlRef.current;
      setDraftRestored(false);
      clearDocumentEditorDraft(draftKey);
      setIsDirty(false);
      onDirtyChange?.(false);
      await utils.documents.getById.invalidate({ id: documentId });
      if (primaryBlock?.id) {
        await utils.documentVariants.listByBlock.invalidate({
          documentId,
          blockId: primaryBlock.id,
        });
      }
      await utils.documentVariants.listByDocument.invalidate({ documentId });
      focus.addToast(tGdocs('proposalSubmitted'), 'success');
      onSynced?.();
    },
    onError: (err) => focus.addToast(err.message, 'error'),
  });

  const lockBlockMutation = trpc.documents.updateBlock.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.documents.getById.invalidate({ id: documentId });
      focus.addToast(
        variables.proposalsLocked ? tGdocs('pinnedBlock') : tGdocs('unpinnedBlock'),
        'success',
      );
    },
    onError: (err) => focus.addToast(err.message, 'error'),
  });

  const isSaving = syncMutation.isPending || proposeMutation.isPending || lockBlockMutation.isPending;

  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);

  const submitProposal = useCallback(() => {
    if (!primaryBlock?.id) {
      focus.addToast(tGdocs('noBlockToEdit'), 'error');
      return;
    }
    if (primaryBlock.proposalsLocked && !canManageDocument) {
      focus.addToast(tGdocs('proposalsLocked'), 'warning');
      return;
    }
    const trimmed = htmlRef.current.trim();
    if (isEmptyTipTapHtml(trimmed)) {
      return;
    }
    if (trimmed.length > MAX_VARIANT_HTML_LENGTH) {
      focus.addToast(t('proposalTooLong', { max: MAX_VARIANT_HTML_LENGTH }), 'error');
      return;
    }
    if (trimmed === lastPersistedHtmlRef.current.trim()) {
      return;
    }

    const { variantCost, quotaRemaining, globalWalletBalance, community } = focus;
    if (variantCost > 0) {
      if (
        !canAffordVariantProposal(variantCost, quotaRemaining, globalWalletBalance, community)
      ) {
        focus.addToast(t('proposeInsufficientPayment', { cost: variantCost }), 'error');
        return;
      }
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
          focus.addToast(t('proposeInsufficientPayment', { cost: variantCost }), 'error');
          return;
        }
      }
      if (quotaAmount > quotaRemaining) {
        focus.addToast(t('proposeInsufficientQuota', { cost: variantCost }), 'error');
        return;
      }
    }

    proposeMutation.mutate({
      documentId,
      blockId: primaryBlock.id,
      content: trimmed,
    });
  }, [primaryBlock, canManageDocument, documentId, focus, proposeMutation, t, tGdocs]);

  const saveOfficial = useCallback(() => {
    if (htmlRef.current === lastPersistedHtmlRef.current) {
      return;
    }
    syncMutation.mutate({
      documentId,
      html: htmlRef.current,
      expectedUpdatedAt: expectedUpdatedAtRef.current
        ? new Date(expectedUpdatedAtRef.current)
        : undefined,
    });
  }, [documentId, syncMutation]);

  const saveNow = useCallback(() => {
    if (isSaving) {
      return;
    }
    if (effectivePersistMode === 'official') {
      saveOfficial();
    } else {
      submitProposal();
    }
  }, [effectivePersistMode, isSaving, saveOfficial, submitProposal]);

  useEffect(() => {
    if (!saveRequestRef) {
      return;
    }
    saveRequestRef.current = saveNow;
    return () => {
      saveRequestRef.current = null;
    };
  }, [saveNow, saveRequestRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveNow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveNow]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const togglePinBlock = () => {
    if (!primaryBlock?.id || !canManageDocument) {
      return;
    }
    lockBlockMutation.mutate({
      documentId,
      blockId: primaryBlock.id,
      proposalsLocked: !primaryBlock.proposalsLocked,
      expectedUpdatedAt: expectedUpdatedAtRef.current
        ? new Date(expectedUpdatedAtRef.current)
        : undefined,
    });
  };

  if (!primaryBlock) {
    return (
      <p className="text-sm text-base-content/60">{tGdocs('noBlockToEdit')}</p>
    );
  }

  const hint =
    effectivePersistMode === 'official'
      ? isDirty
        ? tGdocs('leadEditorDirtyHint')
        : tGdocs('leadEditorHint')
      : isDirty
        ? tGdocs('participantEditorDirtyHint')
        : tGdocs('participantEditorHint');

  return (
    <div className="space-y-3">
      {canManageDocument ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-base-300/50 bg-base-200/40 px-3 py-2 dark:bg-base-300/20">
          <div
            className="inline-flex rounded-lg border border-base-300/60 bg-base-100/80 p-0.5 dark:bg-base-100/10"
            role="group"
            aria-label={tGdocs('persistModeLabel')}
          >
            <button
              type="button"
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                effectivePersistMode === 'propose'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-base-content/70 hover:bg-base-300/50',
              )}
              onClick={() => setPersistMode('propose')}
            >
              {tGdocs('persistModePropose')}
            </button>
            <button
              type="button"
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                effectivePersistMode === 'official'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-base-content/70 hover:bg-base-300/50',
              )}
              onClick={() => setPersistMode('official')}
            >
              {tGdocs('persistModeOfficial')}
            </button>
          </div>
          <Button
            type="button"
            size="sm"
            variant={primaryBlock.proposalsLocked ? 'default' : 'outline'}
            className={cn(
              'h-8 gap-1 rounded-lg text-xs',
              primaryBlock.proposalsLocked && 'bg-primary hover:bg-primary/90',
            )}
            disabled={lockBlockMutation.isPending}
            onClick={togglePinBlock}
            title={tGdocs('pinBlockHint')}
          >
            <Pin
              size={14}
              className={cn('shrink-0', primaryBlock.proposalsLocked && 'fill-current')}
            />
            {tGdocs('pinBlock')}
          </Button>
        </div>
      ) : null}

      <p className="text-xs text-base-content/55">{hint}</p>
      {draftRestored ? (
        <p className="text-xs text-primary/80">{tGdocs('draftRestoredHint')}</p>
      ) : null}

      <DocumentBlockEditor
        key={`gdocs-${documentId}-${primaryBlock.id}`}
        blockType="paragraph"
        content={editorHtml}
        onChange={(html) => {
          htmlRef.current = html;
          setEditorHtml(html);
          writeDocumentEditorDraft(draftKey, html);
          setDraftRestored(false);
          const dirty = html.trim() !== lastPersistedHtmlRef.current.trim();
          setIsDirty(dirty);
          onDirtyChange?.(dirty);
        }}
        placeholder={tGdocs('leadEditorPlaceholder')}
        disabled={isSaving || (primaryBlock.proposalsLocked && !canManageDocument)}
      />

      {syncMutation.isError ? (
        <p className="text-xs text-error">{syncMutation.error.message}</p>
      ) : null}
    </div>
  );
}
