'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DocumentBlockEditor } from '@/features/documents/components/DocumentBlockEditor';
import { DocumentGdocsEditorActionToolbar } from '@/features/documents/components/DocumentGdocsEditorActionToolbar';
import { getPrimaryDocumentBlock } from '@/features/documents/lib/document-primary-block';
import {
  applyPinActionToRanges,
  getEffectiveLockedRanges,
  hasPendingBlockLockChanges,
  pinActionForSelection,
  serverBlockLockState,
  type BlockLockState,
} from '@/features/documents/lib/document-locked-ranges';
import { selectionRangeInBlock } from '@/features/documents/lib/document-html-structure';
import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import { resolveProposeMutationPayload } from '@/features/documents/lib/document-variant-propose-target';
import { DocumentEditorDraftRecovery } from '@/features/documents/components/DocumentEditorDraftRecovery';
import { DocumentProposeCommentDialog } from '@/features/documents/components/DocumentProposeCommentDialog';
import { DocumentRemoteUpdateBanner } from '@/features/documents/components/DocumentRemoteUpdateBanner';
import { DocumentVariantMainPreview } from '@/features/documents/components/DocumentVariantMainPreview';
import {
  archiveDocumentEditorDraft,
  documentEditorHtmlEquals,
  listArchivedDocumentEditorDrafts,
  shouldArchiveDocumentEditorDraft,
  type DocumentEditorDraftArchiveEntry,
} from '@/features/documents/lib/document-editor-draft-archive';
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
import { refetchDocumentProposalCaches } from '@/features/documents/lib/document-variant-cache';
import { buildOpenProposalHighlightRanges } from '@/features/documents/lib/document-open-proposal-highlights';
import { joinDocumentBlocksToHtml } from '@/features/documents/lib/document-html-structure';
import { canUseWalletForVoting } from '@/components/organisms/VotingPopup/voting-utils';
import type { GdocsPersistMode } from '@/features/documents/lib/document-gdocs-editor';
import { trpc } from '@/lib/trpc/client';

export type { GdocsPersistMode } from '@/features/documents/lib/document-gdocs-editor';

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
  const locale = useLocale();
  const focus = useDocumentCanvasFocusRequired();
  const utils = trpc.useUtils();

  const primaryBlock = useMemo(() => getPrimaryDocumentBlock(sections), [sections]);
  const joinedOfficialHtml = useMemo(() => joinDocumentBlocksToHtml(sections), [sections]);
  const initialHtml = (joinedOfficialHtml || primaryBlock?.officialHtml) ?? '';
  const draftKey = documentEditorDraftKey(documentId, focus.userId);
  const htmlRef = useRef(initialHtml);
  const lastPersistedHtmlRef = useRef(initialHtml);
  const expectedUpdatedAtRef = useRef(updatedAt);
  const loadedDocumentIdRef = useRef<string | null>(null);
  const serverRevisionRef = useRef<string>('');
  const acknowledgedRemoteRevisionRef = useRef<string>('');
  const [pendingRemoteBaseline, setPendingRemoteBaseline] = useState<string | null>(null);
  const [archiveListRefreshKey, setArchiveListRefreshKey] = useState(0);
  const [editorHtml, setEditorHtml] = useState(initialHtml);
  const [editorContentKey, setEditorContentKey] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [persistMode, setPersistMode] = useState<GdocsPersistMode>('propose');
  const [proposeCommentOpen, setProposeCommentOpen] = useState(false);
  const [pendingBlockLocks, setPendingBlockLocks] = useState<BlockLockState | null>(null);
  const pendingBlockLocksRef = useRef<BlockLockState | null>(null);
  const [textSelection, setTextSelection] = useState<{ start: number; end: number } | null>(
    null,
  );
  const editorSurfaceRef = useRef<HTMLDivElement>(null);

  pendingBlockLocksRef.current = pendingBlockLocks;

  const serverBaselineHtml = pendingRemoteBaseline ?? initialHtml;

  const serverRevisionLabel = useMemo(() => {
    if (!updatedAt) {
      return null;
    }
    const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return null;
    }
  }, [locale, updatedAt]);

  const effectivePersistMode: GdocsPersistMode = canManageDocument ? persistMode : 'propose';

  const serverRevisionKey = useMemo(() => {
    if (!updatedAt) {
      return '';
    }
    const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    const ms = date.getTime();
    return Number.isNaN(ms) ? '' : date.toISOString();
  }, [updatedAt]);

  const bumpArchiveList = useCallback(() => {
    setArchiveListRefreshKey((k) => k + 1);
  }, []);

  const applyServerBaseline = useCallback(
    (baseline: string) => {
      lastPersistedHtmlRef.current = baseline;
      htmlRef.current = baseline;
      setEditorHtml(baseline);
      setDraftRestored(false);
      setPendingBlockLocks(null);
      setIsDirty(false);
      onDirtyChange?.(false);
    },
    [onDirtyChange],
  );

  const syncEditorDirtyState = useCallback(
    (html: string, locks: BlockLockState | null) => {
      const htmlDirty = !documentEditorHtmlEquals(html, lastPersistedHtmlRef.current);
      const pinDirty = hasPendingBlockLockChanges(
        locks,
        html,
        primaryBlock?.proposalsLocked === true,
        primaryBlock?.lockedRanges,
      );
      const dirty = htmlDirty || pinDirty;
      setIsDirty(dirty);
      onDirtyChange?.(dirty);
      return dirty;
    },
    [onDirtyChange, primaryBlock?.lockedRanges, primaryBlock?.proposalsLocked],
  );

  const hasUnsavedLocalWork = useCallback(
    (baseline: string) => {
      if (isDirty) {
        return true;
      }
      if (
        hasPendingBlockLockChanges(
          pendingBlockLocksRef.current,
          htmlRef.current,
          primaryBlock?.proposalsLocked === true,
          primaryBlock?.lockedRanges,
        )
      ) {
        return true;
      }
      const draft = readDocumentEditorDraft(draftKey);
      if (draft?.html.trim() && !documentEditorHtmlEquals(draft.html, baseline)) {
        return true;
      }
      return !documentEditorHtmlEquals(htmlRef.current, baseline);
    },
    [draftKey, isDirty, primaryBlock?.lockedRanges, primaryBlock?.proposalsLocked],
  );

  const dismissPendingRemoteUpdate = useCallback(() => {
    setPendingRemoteBaseline(null);
    if (serverRevisionKey) {
      acknowledgedRemoteRevisionRef.current = serverRevisionKey;
    }
  }, [serverRevisionKey]);

  const archiveSnapshotBeforeServerApply = useCallback(
    (baseline: string, reason: 'remote_update' | 'user_choice') => {
      const existing = listArchivedDocumentEditorDrafts(documentId, focus.userId);
      const draft = readDocumentEditorDraft(draftKey);
      const snapshot = draft ?? {
        html: htmlRef.current,
        serverUpdatedAt:
          updatedAt instanceof Date
            ? updatedAt.toISOString()
            : typeof updatedAt === 'string'
              ? updatedAt
              : null,
      };
      if (!shouldArchiveDocumentEditorDraft(snapshot, baseline, existing)) {
        return;
      }
      const entry = archiveDocumentEditorDraft(documentId, focus.userId, snapshot, reason);
      if (entry) {
        bumpArchiveList();
      }
    },
    [bumpArchiveList, documentId, draftKey, focus.userId, updatedAt],
  );

  const acceptPendingRemoteBaseline = useCallback(() => {
    if (!pendingRemoteBaseline) {
      return;
    }
    archiveSnapshotBeforeServerApply(pendingRemoteBaseline, 'remote_update');
    clearDocumentEditorDraft(draftKey);
    applyServerBaseline(pendingRemoteBaseline);
    setPendingRemoteBaseline(null);
    acknowledgedRemoteRevisionRef.current = serverRevisionKey;
  }, [
    archiveSnapshotBeforeServerApply,
    applyServerBaseline,
    applyServerBaseline,
    draftKey,
    pendingRemoteBaseline,
    serverRevisionKey,
  ]);

  const restoreArchivedDraft = useCallback(
    (entry: DocumentEditorDraftArchiveEntry) => {
      htmlRef.current = entry.html;
      setEditorHtml(entry.html);
      writeDocumentEditorDraft(draftKey, entry.html, updatedAt);
      setDraftRestored(true);
      setIsDirty(true);
      onDirtyChange?.(true);
      setPendingRemoteBaseline(null);
    },
    [draftKey, onDirtyChange, updatedAt],
  );

  const showServerFromVersionPicker = useCallback(() => {
    const baseline = serverBaselineHtml;
    const currentHtml = htmlRef.current;
    if (documentEditorHtmlEquals(currentHtml, baseline)) {
      setPendingRemoteBaseline(null);
      return;
    }

    archiveSnapshotBeforeServerApply(baseline, 'user_choice');
    clearDocumentEditorDraft(draftKey);
    applyServerBaseline(baseline);
    setPendingRemoteBaseline(null);
    acknowledgedRemoteRevisionRef.current = serverRevisionKey;
  }, [
    applyServerBaseline,
    archiveSnapshotBeforeServerApply,
    draftKey,
    serverBaselineHtml,
    serverRevisionKey,
  ]);

  useEffect(() => {
    onPersistModeChange?.(effectivePersistMode);
  }, [effectivePersistMode, onPersistModeChange]);

  useEffect(() => {
    expectedUpdatedAtRef.current = updatedAt;
  }, [updatedAt]);

  /**
   * Hydrate from server or session draft. Remote revision bumps show a banner when
   * there is unsaved local work instead of overwriting the editor.
   */
  useEffect(() => {
    const baseline = initialHtml;
    const isNewDocument = loadedDocumentIdRef.current !== documentId;

    if (isNewDocument) {
      loadedDocumentIdRef.current = documentId;
      serverRevisionRef.current = serverRevisionKey;
      acknowledgedRemoteRevisionRef.current = '';
      setPendingRemoteBaseline(null);
      setPendingBlockLocks(null);
    }

    const remoteRevisionChanged =
      !isNewDocument &&
      Boolean(serverRevisionKey) &&
      Boolean(serverRevisionRef.current) &&
      serverRevisionKey !== serverRevisionRef.current;

    if (remoteRevisionChanged) {
      serverRevisionRef.current = serverRevisionKey;

      if (
        hasUnsavedLocalWork(baseline) &&
        acknowledgedRemoteRevisionRef.current !== serverRevisionKey
      ) {
        setPendingRemoteBaseline(baseline);
        return;
      }

      setPendingRemoteBaseline(null);
      clearDocumentEditorDraft(draftKey);
      applyServerBaseline(baseline);
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
      !documentEditorHtmlEquals(draft.html, baseline);

    if (canRestoreDraft) {
      htmlRef.current = draft.html;
      setEditorHtml(draft.html);
      setDraftRestored(true);
      setIsDirty(true);
      onDirtyChange?.(true);
      return;
    }

    if (draft && (draftStale || documentEditorHtmlEquals(draft.html, baseline))) {
      clearDocumentEditorDraft(draftKey);
    }

    if (draft && draftStale) {
      const hadStaleDraft = !documentEditorHtmlEquals(draft.html, baseline);
      if (hadStaleDraft) {
        archiveDocumentEditorDraft(documentId, focus.userId, draft, 'remote_update');
        bumpArchiveList();
      }
      clearDocumentEditorDraft(draftKey);
    }

    applyServerBaseline(baseline);
  }, [
    applyServerBaseline,
    bumpArchiveList,
    documentId,
    draftKey,
    focus.userId,
    hasUnsavedLocalWork,
    initialHtml,
    isDirty,
    onDirtyChange,
    serverRevisionKey,
    updatedAt,
  ]);

  const syncMutation = trpc.documents.syncStructureFromHtml.useMutation({
    onSuccess: async (result) => {
      const serverHtml = joinDocumentBlocksToHtml(result.document.sections);
      expectedUpdatedAtRef.current = result.document.updatedAt;
      lastPersistedHtmlRef.current = serverHtml;
      htmlRef.current = serverHtml;
      setEditorHtml(serverHtml);
      setDraftRestored(false);
      setPendingRemoteBaseline(null);
      clearDocumentEditorDraft(draftKey);
      const stillDirty = hasPendingBlockLockChanges(
        pendingBlockLocksRef.current,
        serverHtml,
        primaryBlock?.proposalsLocked === true,
        primaryBlock?.lockedRanges,
      );
      setIsDirty(stillDirty);
      onDirtyChange?.(stillDirty);
      utils.documents.getById.setData({ id: documentId }, result.document);
      await utils.documentVariants.listByDocument.invalidate({ documentId });
      onSynced?.();
    },
  });

  const proposeMutation = trpc.documentVariants.propose.useMutation({
    onSuccess: async (variant) => {
      lastPersistedHtmlRef.current = htmlRef.current;
      setDraftRestored(false);
      setPendingRemoteBaseline(null);
      clearDocumentEditorDraft(draftKey);
      setIsDirty(false);
      onDirtyChange?.(false);
      focus.setFocusedBlockId(variant.blockId);
      await utils.documents.getById.invalidate({ id: documentId });
      await refetchDocumentProposalCaches(utils, documentId, variant.blockId);
      setEditorContentKey((k) => k + 1);
      focus.addToast(tGdocs('proposalSubmitted'), 'success');
      onSynced?.();
    },
    onError: (err) => focus.addToast(err.message, 'error'),
  });

  const lockBlockMutation = trpc.documents.updateBlock.useMutation({
    onSuccess: async (_data, variables) => {
      setPendingBlockLocks(null);
      await utils.documents.getById.invalidate({ id: documentId });
      focus.addToast(
        variables.proposalsLocked ? tGdocs('pinnedBlock') : tGdocs('unpinnedBlock'),
        'success',
      );
    },
    onError: (err) => focus.addToast(err.message, 'error'),
  });

  const persistPendingBlockLocks = useCallback(async () => {
    if (!primaryBlock?.id || !pendingBlockLocks) {
      return;
    }
    if (
      !hasPendingBlockLockChanges(
        pendingBlockLocks,
        htmlRef.current,
        primaryBlock.proposalsLocked === true,
        primaryBlock.lockedRanges,
      )
    ) {
      return;
    }
    await lockBlockMutation.mutateAsync({
      documentId,
      blockId: primaryBlock.id,
      lockedRanges: pendingBlockLocks.lockedRanges,
      proposalsLocked: pendingBlockLocks.proposalsLocked,
      expectedUpdatedAt: expectedUpdatedAtRef.current
        ? new Date(expectedUpdatedAtRef.current)
        : undefined,
    });
  }, [documentId, lockBlockMutation, pendingBlockLocks, primaryBlock]);

  const isSaving = syncMutation.isPending || proposeMutation.isPending || lockBlockMutation.isPending;

  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);

  const executePropose = useCallback(
    (proposerComment?: string) => {
      const trimmed = htmlRef.current.trim();
      const payload = resolveProposeMutationPayload(sections, lastPersistedHtmlRef.current, trimmed);
      proposeMutation.mutate({
        documentId,
        ...payload,
        ...(proposerComment ? { proposerComment } : {}),
      });
      setProposeCommentOpen(false);
    },
    [documentId, proposeMutation, sections],
  );

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
    if (documentEditorHtmlEquals(trimmed, lastPersistedHtmlRef.current)) {
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

    setProposeCommentOpen(true);
  }, [primaryBlock, canManageDocument, focus, sections, t, tGdocs]);

  const saveOfficial = useCallback(async () => {
    const htmlDirty = !documentEditorHtmlEquals(htmlRef.current, lastPersistedHtmlRef.current);
    const pinDirty = hasPendingBlockLockChanges(
      pendingBlockLocks,
      htmlRef.current,
      primaryBlock?.proposalsLocked === true,
      primaryBlock?.lockedRanges,
    );
    if (!htmlDirty && !pinDirty) {
      return;
    }

    if (htmlDirty) {
      const result = await syncMutation.mutateAsync({
        documentId,
        html: htmlRef.current,
        expectedUpdatedAt: expectedUpdatedAtRef.current
          ? new Date(expectedUpdatedAtRef.current)
          : undefined,
      });
      expectedUpdatedAtRef.current = result.document.updatedAt;
    }
    if (pinDirty) {
      await persistPendingBlockLocks();
    }
    const stillDirty = syncEditorDirtyState(htmlRef.current, pendingBlockLocksRef.current);
    if (!stillDirty) {
      focus.addToast(tGdocs('leadEditorSaved'), 'success');
    }
  }, [
    documentId,
    pendingBlockLocks,
    persistPendingBlockLocks,
    primaryBlock?.lockedRanges,
    primaryBlock?.proposalsLocked,
    focus,
    syncEditorDirtyState,
    syncMutation,
    tGdocs,
  ]);

  const saveNow = useCallback(() => {
    if (isSaving || !primaryBlock?.id) {
      return;
    }
    const htmlDirty = !documentEditorHtmlEquals(htmlRef.current, lastPersistedHtmlRef.current);
    const pinDirty = hasPendingBlockLockChanges(
      pendingBlockLocks,
      htmlRef.current,
      primaryBlock.proposalsLocked === true,
      primaryBlock.lockedRanges,
    );
    if (!htmlDirty && !pinDirty) {
      return;
    }

    if (effectivePersistMode === 'official') {
      void saveOfficial();
      return;
    }

    if (pinDirty && canManageDocument) {
      void (async () => {
        try {
          await persistPendingBlockLocks();
          if (htmlDirty) {
            submitProposal();
          } else {
            syncEditorDirtyState(htmlRef.current, null);
          }
        } catch {
          // toast from mutation
        }
      })();
      return;
    }

    if (htmlDirty) {
      submitProposal();
    }
  }, [
    canManageDocument,
    effectivePersistMode,
    isSaving,
    pendingBlockLocks,
    persistPendingBlockLocks,
    primaryBlock,
    saveOfficial,
    submitProposal,
    syncEditorDirtyState,
  ]);

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

  const effectiveBlockLocks = useMemo(() => {
    if (pendingBlockLocks) {
      return pendingBlockLocks;
    }
    return serverBlockLockState(
      editorHtml,
      primaryBlock?.proposalsLocked === true,
      primaryBlock?.lockedRanges,
    );
  }, [editorHtml, pendingBlockLocks, primaryBlock?.lockedRanges, primaryBlock?.proposalsLocked]);

  const effectiveLockedRanges = useMemo(
    () =>
      getEffectiveLockedRanges(
        editorHtml,
        effectiveBlockLocks.proposalsLocked,
        effectiveBlockLocks.lockedRanges,
      ),
    [editorHtml, effectiveBlockLocks],
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

  const threadsQuery = trpc.documentVariants.listByDocument.useQuery(
    { documentId },
    { enabled: Boolean(documentId) },
  );

  const proposalHighlightRanges = useMemo(() => {
    const open =
      threadsQuery.data?.threads.flatMap((thread) =>
        thread.variants.filter((v) => v.status === 'open'),
      ) ?? [];
    return buildOpenProposalHighlightRanges(sections, open, {
      tooltipPrefix: tGdocs('openProposalsTooltipPrefix'),
    });
  }, [sections, threadsQuery.data, tGdocs]);

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
    const baseRanges = effectiveLockedRanges;
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

    const nextLocks: BlockLockState = {
      lockedRanges: nextRanges,
      proposalsLocked: fullBlockPinned,
    };
    setPendingBlockLocks(nextLocks);
    syncEditorDirtyState(htmlRef.current, nextLocks);
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

  if (focus.variantPreview) {
    return (
      <div className="space-y-3">
        <DocumentVariantMainPreview
          target={focus.variantPreview}
          showDiff={focus.showVariantDiff}
          onShowDiffChange={focus.setShowVariantDiff}
          onClose={focus.clearVariantPreview}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <DocumentProposeCommentDialog
        open={proposeCommentOpen}
        onOpenChange={setProposeCommentOpen}
        onConfirm={executePropose}
        isPending={proposeMutation.isPending}
      />
      <p className="text-xs text-base-content/55">{hint}</p>
      {draftRestored ? (
        <p className="text-xs text-primary/80">{tGdocs('draftRestoredHint')}</p>
      ) : null}

      {pendingRemoteBaseline ? (
        <DocumentRemoteUpdateBanner
          onKeepMine={dismissPendingRemoteUpdate}
          onShowServer={acceptPendingRemoteBaseline}
        />
      ) : null}

      <DocumentEditorDraftRecovery
        documentId={documentId}
        userId={focus.userId}
        refreshKey={archiveListRefreshKey}
        serverBaselineHtml={serverBaselineHtml}
        editorHtml={editorHtml}
        serverRevisionLabel={serverRevisionLabel}
        onShowServer={showServerFromVersionPicker}
        onRestore={restoreArchivedDraft}
        onListChange={bumpArchiveList}
      />

      <div ref={editorSurfaceRef} className="gdocs-editor-surface">
        <DocumentBlockEditor
          key={`gdocs-${documentId}-${primaryBlock.id}-${editorContentKey}`}
          blockType="paragraph"
          content={editorHtml}
          toolbarSecondary={
            <DocumentGdocsEditorActionToolbar
              canManageDocument={canManageDocument}
              effectivePersistMode={effectivePersistMode}
              onPersistModeChange={setPersistMode}
              pinToolbarAction={pinToolbarAction}
              hasTextSelection={textSelection != null}
              onPinClick={applyPinToSelection}
              saveButtonLabel={saveButtonLabel}
              isDirty={isDirty}
              isSaving={isSaving}
              onSave={saveNow}
            />
          }
          onChange={(html) => {
            htmlRef.current = html;
            setEditorHtml(html);
            setDraftRestored(false);
            if (!documentEditorHtmlEquals(html, lastPersistedHtmlRef.current)) {
              writeDocumentEditorDraft(draftKey, html, updatedAt);
            } else {
              clearDocumentEditorDraft(draftKey);
            }
            syncEditorDirtyState(html, pendingBlockLocksRef.current);
          }}
          placeholder={tGdocs('leadEditorPlaceholder')}
          disabled={isSaving || (primaryBlock.proposalsLocked && !canManageDocument)}
          lockedRanges={effectiveLockedRanges}
          lockedRangeTooltip={lockedRangeTooltip}
          proposalHighlightRanges={proposalHighlightRanges}
        />
      </div>

      {syncMutation.isError ? (
        <p className="text-xs text-error">{syncMutation.error.message}</p>
      ) : null}
    </div>
  );
}
