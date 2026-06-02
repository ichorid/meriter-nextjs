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
  | { kind: 'adminOverride'; blockId: string };

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
  selectedRange: DocumentSelectionRange | null;
  setSelectedRange: (range: DocumentSelectionRange | null) => void;
  getBlock: (blockId: string) => DocBlock | null;
  mobileSheet: DocumentMobileSheet;
  openMobileSheet: (sheet: Exclude<DocumentMobileSheet, { kind: 'closed' }>) => void;
  closeMobileSheet: () => void;
  adminDialog: DocumentAdminDialog;
  openAdminDialog: (dialog: Exclude<DocumentAdminDialog, { kind: 'closed' }>) => void;
  closeAdminDialog: () => void;
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
  const [selectedRange, setSelectedRange] = useState<DocumentSelectionRange | null>(null);

  const setFocusedBlockIdWrapped = useCallback((blockId: string | null) => {
    setFocusedBlockId(blockId);
    setFocusedVariantId(null);
    setSelectedRange(null);
  }, []);
  const [mobileSheet, setMobileSheet] = useState<DocumentMobileSheet>({ kind: 'closed' });
  const [adminDialog, setAdminDialog] = useState<DocumentAdminDialog>({ kind: 'closed' });

  const blockById = useMemo(() => {
    const map = new Map<string, DocBlock>();
    for (const { blocks } of groupBlocksBySection(sections)) {
      for (const block of blocks) {
        map.set(block.id, block);
      }
    }
    return map;
  }, [sections]);

  const getBlock = useCallback((blockId: string) => blockById.get(blockId) ?? null, [blockById]);

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
      selectedRange,
      setSelectedRange,
      getBlock,
      mobileSheet,
      openMobileSheet,
      closeMobileSheet,
      adminDialog,
      openAdminDialog,
      closeAdminDialog,
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
      selectedRange,
      setSelectedRange,
      getBlock,
      mobileSheet,
      openMobileSheet,
      closeMobileSheet,
      adminDialog,
      openAdminDialog,
      closeAdminDialog,
    ],
  );

  return (
    <DocumentCanvasFocusContext.Provider value={value}>{children}</DocumentCanvasFocusContext.Provider>
  );
}
