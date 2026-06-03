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
  applyPinActionToRanges,
  getEditableLockedRanges,
  getEffectiveLockedRanges,
  pinActionForSelection,
} from '@/features/documents/lib/document-locked-ranges';
import { selectionRangeInBlock } from '@/features/documents/lib/document-html-structure';
import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import { resolveProposeMutationPayload } from '@/features/documents/lib/document-variant-propose-target';
import {
  clearDocumentEditorDraft,
  documentEditorDraftKey,
  isDocumentEditorDraftStale,
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
  const serverRevisionRef = useRef<string>('');
  const [editorHtml, setEditorHtml] = useState(initialHtml);
  const [editorContentKey, setEditorContentKey] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [persistMode, setPersistMode] = useState<GdocsPersistMode>('propose');
  const [textSelection, setTextSelection] = useState<{ start: number; end: number } | null>(
    null,
  );
  const editorSurfaceRef = useRef<HTMLDivElement>(null);

  const effectivePersistMode: GdocsPersistMode = canManageDocument ? persistMode : 'propose';

  const serverRevisionKey = useMemo(() => {
    if (!updatedAt) {
      return '';
    }
    const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    const ms = date.getTime();
    return Number.isNaN(ms) ? '' : date.toISOString();
  }, [updatedAt]);

  const applyServerBaseline = useCallback(
    (baseline: string) => {
      lastPersistedHtmlRef.current = baseline;
      htmlRef.current = baseline;
      setEditorHtml(baseline);
      setDraftRestored(false);
      setIsDirty(false);
      onDirtyChange?.(false);
    },
    [onDirtyChange],
  );

  useEffect(() => {
    onPersistModeChange?.(effectivePersistMode);
  }, [effectivePersistMode, onPersistModeChange]);

  useEffect(() => {
    expectedUpdatedAtRef.current = updatedAt;
  }, [updatedAt]);

  /**
   * Hydrate from server or session draft. Discard local draft when document.updatedAt
   * changed (another user saved official text while this tab was open).
   */
  useEffect(() => {
    const baseline = initialHtml;
    const isNewDocument = loadedDocumentIdRef.current !== documentId;

    if (isNewDocument) {
      loadedDocumentIdRef.current = documentId;
      serverRevisionRef.current = serverRevisionKey;
    }

    const remoteRevisionChanged =
      !isNewDocument &&
      Boolean(serverRevisionKey) &&
      Boolean(serverRevisionRef.current) &&
      serverRevisionKey !== serverRevisionRef.current;

    if (remoteRevisionChanged) {
      serverRevisionRef.current = serverRevisionKey;
      const draft = readDocumentEditorDraft(draftKey);
      const hadLocalWork =
        isDirty ||
        Boolean(draft?.html.trim() && draft.html.trim() !== baseline.trim());
      clearDocumentEditorDraft(draftKey);
      applyServerBaseline(baseline);
      setEditorContentKey((k) => k + 1);
      if (hadLocalWork) {
        focus.addToast(tGdocs('remoteDocumentUpdate'), 'info');
      }
      return;
    }

    if (!isNewDocument && isDirty) {
      return;
    }

    if (!serverRevisionRef.current && serverRevisionKey) {
      serverRevisionRef.current = serverRevisionKey;
    }

    const draft = readDocumentEditorDraft(draftKey);
    const draftStale = isDocumentEditorDraftStale(draft, updatedAt);
    const canRestoreDraft =
      draft &&
      !draftStale &&
      draft.html.trim() !== baseline.trim();

    if (canRestoreDraft) {
      htmlRef.current = draft.html;
      setEditorHtml(draft.html);
      setDraftRestored(true);
      setIsDirty(true);
      onDirtyChange?.(true);
      return;
    }

    if (draft && draftStale) {
      const hadStaleDraft = draft.html.trim() !== baseline.trim();
      clearDocumentEditorDraft(draftKey);
      if (hadStaleDraft) {
        focus.addToast(tGdocs('remoteDocumentUpdate'), 'info');
      }
    }

    applyServerBaseline(baseline);
  }, [
    applyServerBaseline,
    documentId,
    draftKey,
    focus,
    initialHtml,
    isDirty,
    onDirtyChange,
    serverRevisionKey,
    tGdocs,
    updatedAt,
  ]);

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

    const payload = resolveProposeMutationPayload(sections, lastPersistedHtmlRef.current, trimmed);
    proposeMutation.mutate({
      documentId,
      ...payload,
    });
  }, [primaryBlock, canManageDocument, documentId, focus, proposeMutation, sections, t, tGdocs]);

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

  const plainLength = useMemo(() => blockHtmlToPlainText(editorHtml).length, [editorHtml]);

  const effectiveLockedRanges = useMemo(
    () =>
      getEffectiveLockedRanges(
        editorHtml,
        primaryBlock?.proposalsLocked === true,
        primaryBlock?.lockedRanges,
      ),
    [editorHtml, primaryBlock?.proposalsLocked, primaryBlock?.lockedRanges],
  );

  const pinToolbarAction = useMemo(() => {
    if (!textSelection) {
      return null;
    }
    return pinActionForSelection(
      effectiveLockedRanges,
      textSelection.start,
      textSelection.end,
    );
  }, [effectiveLockedRanges, textSelection]);

  const lockedRangeTooltip = canManageDocument
    ? tGdocs('lockedRangeTooltipAdmin', {
        defaultMessage:
          'Текст закреплён администратором. Чтобы редактировать его, выделите текст и нажмите кнопку «Открепить» в верхней панели',
      })
    : tGdocs('lockedRangeTooltip', {
        defaultMessage: 'Текст закреплён администратором',
      });

  useEffect(() => {
    const readSelection = () => {
      const prose = editorSurfaceRef.current?.querySelector('.ProseMirror');
      if (!prose) {
        setTextSelection(null);
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setTextSelection(null);
        return;
      }
      const range = selectionRangeInBlock(prose as HTMLElement, sel);
      setTextSelection(range ? { start: range.rangeStart, end: range.rangeEnd } : null);
    };
    document.addEventListener('selectionchange', readSelection);
    return () => document.removeEventListener('selectionchange', readSelection);
  }, [editorHtml]);

  const applyPinToSelection = () => {
    if (!primaryBlock?.id || !canManageDocument || !textSelection || !pinToolbarAction) {
      return;
    }
    const baseRanges = getEditableLockedRanges(
      editorHtml,
      primaryBlock.proposalsLocked === true,
      primaryBlock.lockedRanges,
    );
    const nextRanges = applyPinActionToRanges(
      baseRanges,
      pinToolbarAction,
      textSelection.start,
      textSelection.end,
      plainLength,
    );
    const fullBlockPinned =
      plainLength > 0 &&
      nextRanges.length === 1 &&
      nextRanges[0]!.rangeStart === 0 &&
      nextRanges[0]!.rangeEnd === plainLength;

    lockBlockMutation.mutate({
      documentId,
      blockId: primaryBlock.id,
      lockedRanges: nextRanges,
      proposalsLocked: fullBlockPinned,
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

  const saveButtonLabel =
    canManageDocument && effectivePersistMode === 'official'
      ? tGdocs('leadEditorSave')
      : tGdocs('submitProposal');

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 rounded-xl border border-base-300/50 bg-base-200/40 px-2 py-2 sm:gap-2 sm:px-3 dark:bg-base-300/20">
        {canManageDocument ? (
          <>
            <div
              className="inline-flex shrink-0 rounded-lg border border-base-300/60 bg-base-100/80 p-0.5 dark:bg-base-100/10"
              role="group"
              aria-label={tGdocs('persistModeLabel')}
            >
              <button
                type="button"
                className={cn(
                  'whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3',
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
                  'whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3',
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
              variant={pinToolbarAction === 'unlock' ? 'default' : 'outline'}
              className={cn(
                'h-8 shrink-0 gap-1 whitespace-nowrap rounded-lg px-2 text-xs sm:px-3',
                pinToolbarAction === 'unlock' && 'bg-primary hover:bg-primary/90',
              )}
              disabled={
                lockBlockMutation.isPending || !textSelection || !pinToolbarAction
              }
              onClick={applyPinToSelection}
              title={
                textSelection
                  ? tGdocs('pinBlockHint', {
                      defaultMessage: 'Закрепить или открепить выделенный фрагмент',
                    })
                  : tGdocs('pinSelectTextHint', {
                      defaultMessage: 'Выделите фрагмент в тексте',
                    })
              }
            >
              <Pin
                size={14}
                className={cn('shrink-0', pinToolbarAction === 'unlock' && 'fill-current')}
              />
              {pinToolbarAction === 'unlock'
                ? tGdocs('unpinBlock', { defaultMessage: 'Открепить' })
                : tGdocs('pinBlock', { defaultMessage: 'Закрепить' })}
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="ml-auto h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-xs"
          onClick={saveNow}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? tGdocs('leadEditorSaving') : saveButtonLabel}
        </Button>
      </div>

      <p className="text-xs text-base-content/55">{hint}</p>
      {draftRestored ? (
        <p className="text-xs text-primary/80">{tGdocs('draftRestoredHint')}</p>
      ) : null}

      <div ref={editorSurfaceRef} className="gdocs-editor-surface">
        <DocumentBlockEditor
          key={`gdocs-${documentId}-${primaryBlock.id}-${editorContentKey}`}
          blockType="paragraph"
          content={editorHtml}
          onChange={(html) => {
            htmlRef.current = html;
            setEditorHtml(html);
            writeDocumentEditorDraft(draftKey, html, updatedAt);
            setDraftRestored(false);
            const dirty = html.trim() !== lastPersistedHtmlRef.current.trim();
            setIsDirty(dirty);
            onDirtyChange?.(dirty);
          }}
          placeholder={tGdocs('leadEditorPlaceholder')}
          disabled={isSaving || (primaryBlock.proposalsLocked && !canManageDocument)}
          lockedRanges={effectiveLockedRanges}
          lockedRangeTooltip={lockedRangeTooltip}
        />
      </div>

      {syncMutation.isError ? (
        <p className="text-xs text-error">{syncMutation.error.message}</p>
      ) : null}
    </div>
  );
}
