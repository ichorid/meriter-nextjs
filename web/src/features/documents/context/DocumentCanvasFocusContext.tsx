'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Community } from '@meriter/shared-types';
import type { DocBlock, DocTranslate } from '@/features/documents/lib/document-canvas-shared';
import { groupBlocksBySection } from '@/features/documents/lib/document-canvas-shared';

export type DocumentMobileSheet =
  | { kind: 'closed' }
  | { kind: 'blockMenu' }
  | { kind: 'propose' }
  | { kind: 'vote'; variantId: string };

export type DocumentAdminDialog =
  | { kind: 'closed' }
  | { kind: 'history'; blockId: string }
  | { kind: 'adminOverride'; blockId: string }
  | { kind: 'closeVoting'; blockId: string };

export type DocumentVariantPreviewTarget = {
  blockId: string;
  /** Omitted when preview uses joined document HTML (unified editor). */
  blockType?: string;
  /** Official baseline for diff; joined document HTML in gdocs compact rail. */
  officialHtml: string;
  /** Block-scoped HTML for compare toggle (avoids full-document word diff). */
  compareOfficialHtml?: string;
  compareVariantHtml?: string;
  proposedByDisplayName?: string;
  proposedAt?: string | Date;
  proposerComment?: string | null;
} & (
  | { kind: 'official' }
  | {
      kind: 'variant';
      variantId: string;
      variantHtml: string;
      /** Persisted propose payload (joined HTML); used for diff, not preview HTML. */
      variantContent?: string;
      proposalScope?: 'block' | 'patches';
      patches?: Array<{
        blockId: string;
        rangeStart: number;
        rangeEnd: number;
        proposedText: string;
        previewContent: string;
        insertAfterBlockId?: string;
        insertBlocks?: Array<{ blockType: string; officialContent: string }>;
      }>;
      rangeStart?: number;
      rangeEnd?: number;
      proposedText?: string;
      /** Sections snapshot for document-scoped range diff in main preview. */
      sectionsForRevision?: unknown;
    }
);

export type DocumentSelectionRange = {
  blockId: string;
  rangeStart: number;
  rangeEnd: number;
  excerpt: string;
  blockType: string;
  officialHtml: string;
};

export interface DocumentCanvasFocusContextValue {
  documentId: string;
  docMode: 'manual' | 'auto';
  variantCost: number;
  votingDurationHours: number;
  docAllowDownvotes: boolean;
  canManageDocument: boolean;
  community: Community | null;
  quotaRemaining: number;
  walletBalance: number;
  globalWalletBalance: number;
  userId: string;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  t: DocTranslate;
  focusedBlockId: string | null;
  setFocusedBlockId: (blockId: string | null) => void;
  focusedVariantId: string | null;
  setFocusedVariantId: (variantId: string | null) => void;
  variantPreview: DocumentVariantPreviewTarget | null;
  showVariantDiff: boolean;
  setShowVariantDiff: (value: boolean) => void;
  setVariantPreview: (target: DocumentVariantPreviewTarget | null) => void;
  clearVariantPreview: () => void;
  selectedRange: DocumentSelectionRange | null;
  setSelectedRange: (range: DocumentSelectionRange | null) => void;
  getBlock: (blockId: string) => DocBlock | null;
  getAdjacentBlocks: (blockId: string) => {
    prev: DocBlock | null;
    next: DocBlock | null;
  };
  mobileSheet: DocumentMobileSheet;
  openMobileSheet: (sheet: Exclude<DocumentMobileSheet, { kind: 'closed' }>) => void;
  closeMobileSheet: () => void;
  adminDialog: DocumentAdminDialog;
  openAdminDialog: (dialog: Exclude<DocumentAdminDialog, { kind: 'closed' }>) => void;
  closeAdminDialog: () => void;
  /** Bumped after governance refetch so the unified editor applies server baseline immediately. */
  editorResyncNonce: number;
  bumpEditorResync: () => void;
}

const DocumentCanvasFocusContext = createContext<DocumentCanvasFocusContextValue | null>(null);

export function useDocumentCanvasFocus(): DocumentCanvasFocusContextValue | null {
  return useContext(DocumentCanvasFocusContext);
}

export function useDocumentCanvasFocusRequired(): DocumentCanvasFocusContextValue {
  const ctx = useContext(DocumentCanvasFocusContext);
  if (!ctx) {
    throw new Error('useDocumentCanvasFocusRequired must be used within DocumentCanvasFocusProvider');
  }
  return ctx;
}

export interface DocumentCanvasFocusProviderProps {
  documentId: string;
  sections: unknown;
  docMode: 'manual' | 'auto';
  variantCost: number;
  votingDurationHours: number;
  docAllowDownvotes: boolean;
  canManageDocument: boolean;
  community: Community | null;
  quotaRemaining: number;
  walletBalance: number;
  globalWalletBalance: number;
  userId: string;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  t: DocTranslate;
  children: ReactNode;
}

export function DocumentCanvasFocusProvider({
  documentId,
  sections,
  docMode,
  variantCost,
  votingDurationHours,
  docAllowDownvotes,
  canManageDocument,
  community,
  quotaRemaining,
  walletBalance,
  globalWalletBalance,
  userId,
  addToast,
  t,
  children,
}: DocumentCanvasFocusProviderProps) {
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [focusedVariantId, setFocusedVariantId] = useState<string | null>(null);
  const [variantPreview, setVariantPreviewState] = useState<DocumentVariantPreviewTarget | null>(
    null,
  );
  const [showVariantDiff, setShowVariantDiff] = useState(true);
  const [selectedRange, setSelectedRange] = useState<DocumentSelectionRange | null>(null);

  const clearVariantPreview = useCallback(() => {
    setVariantPreviewState(null);
    setFocusedVariantId(null);
    setShowVariantDiff(true);
  }, []);

  const setVariantPreview = useCallback((target: DocumentVariantPreviewTarget | null) => {
    setVariantPreviewState(target);
    setFocusedVariantId(target?.kind === 'variant' ? target.variantId : null);
    if (target) {
      setFocusedBlockId(target.blockId);
      setShowVariantDiff(true);
    }
    setSelectedRange(null);
  }, []);

  const setFocusedBlockIdWrapped = useCallback((blockId: string | null) => {
    setFocusedBlockId(blockId);
    setFocusedVariantId(null);
    setVariantPreviewState(null);
    setSelectedRange(null);
  }, []);
  const [mobileSheet, setMobileSheet] = useState<DocumentMobileSheet>({ kind: 'closed' });
  const [adminDialog, setAdminDialog] = useState<DocumentAdminDialog>({ kind: 'closed' });
  const [editorResyncNonce, setEditorResyncNonce] = useState(0);
  const bumpEditorResync = useCallback(() => {
    setEditorResyncNonce((n) => n + 1);
  }, []);

  const blockById = useMemo(() => {
    const map = new Map<string, DocBlock>();
    for (const { blocks } of groupBlocksBySection(sections)) {
      for (const block of blocks) {
        map.set(block.id, block);
      }
    }
    return map;
  }, [sections]);

  const orderedBlocks = useMemo(
    () =>
      groupBlocksBySection(sections)
        .flatMap((g) => g.blocks)
        .slice()
        .sort((a, b) => a.order - b.order),
    [sections],
  );

  const getBlock = useCallback((blockId: string) => blockById.get(blockId) ?? null, [blockById]);

  const getAdjacentBlocks = useCallback(
    (blockId: string) => {
      const index = orderedBlocks.findIndex((b) => b.id === blockId);
      if (index < 0) {
        return { prev: null, next: null };
      }
      return {
        prev: index > 0 ? (orderedBlocks[index - 1] ?? null) : null,
        next:
          index < orderedBlocks.length - 1 ? (orderedBlocks[index + 1] ?? null) : null,
      };
    },
    [orderedBlocks],
  );

  const openMobileSheet = useCallback(
    (sheet: Exclude<DocumentMobileSheet, { kind: 'closed' }>) => {
      setMobileSheet(sheet);
    },
    [],
  );

  const closeMobileSheet = useCallback(() => {
    setMobileSheet({ kind: 'closed' });
  }, []);

  const openAdminDialog = useCallback(
    (dialog: Exclude<DocumentAdminDialog, { kind: 'closed' }>) => {
      setAdminDialog(dialog);
    },
    [],
  );

  const closeAdminDialog = useCallback(() => {
    setAdminDialog({ kind: 'closed' });
  }, []);

  const value = useMemo<DocumentCanvasFocusContextValue>(
    () => ({
      documentId,
      docMode,
      variantCost,
      votingDurationHours,
      docAllowDownvotes,
      canManageDocument,
      community,
      quotaRemaining,
      walletBalance,
      globalWalletBalance,
      userId,
      addToast,
      t,
      focusedBlockId,
      setFocusedBlockId: setFocusedBlockIdWrapped,
      focusedVariantId,
      setFocusedVariantId,
      variantPreview,
      showVariantDiff,
      setShowVariantDiff,
      setVariantPreview,
      clearVariantPreview,
      selectedRange,
      setSelectedRange,
      getBlock,
      getAdjacentBlocks,
      mobileSheet,
      openMobileSheet,
      closeMobileSheet,
      adminDialog,
      openAdminDialog,
      closeAdminDialog,
      editorResyncNonce,
      bumpEditorResync,
    }),
    [
      documentId,
      docMode,
      variantCost,
      votingDurationHours,
      docAllowDownvotes,
      canManageDocument,
      community,
      quotaRemaining,
      walletBalance,
      globalWalletBalance,
      userId,
      addToast,
      t,
      focusedBlockId,
      setFocusedBlockIdWrapped,
      focusedVariantId,
      setFocusedVariantId,
      variantPreview,
      showVariantDiff,
      setShowVariantDiff,
      setVariantPreview,
      clearVariantPreview,
      selectedRange,
      setSelectedRange,
      getBlock,
      getAdjacentBlocks,
      mobileSheet,
      openMobileSheet,
      closeMobileSheet,
      adminDialog,
      openAdminDialog,
      closeAdminDialog,
      editorResyncNonce,
      bumpEditorResync,
    ],
  );

  return (
    <DocumentCanvasFocusContext.Provider value={value}>{children}</DocumentCanvasFocusContext.Provider>
  );
}
