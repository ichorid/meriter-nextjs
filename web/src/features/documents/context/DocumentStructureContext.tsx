'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { DocumentStructureToolbar } from '@/components/molecules/RichTextEditor';
import type { DocumentStructureToolbarActions } from '@/components/molecules/RichTextEditor';
import type { MeriterBlockType } from '@/features/documents/types/document-block';

export interface DocSectionSlice {
  id: string;
  title?: string;
  order: number;
  blocks?: { id: string; order?: number }[];
}

export interface DocumentStructureContextValue {
  canManageDocument: boolean;
  structureMode: boolean;
  setStructureMode: (enabled: boolean) => void;
  toggleStructureMode: () => void;
  structureBusy: boolean;
  canRemoveSection: boolean;
  canRemoveBlock: boolean;
  onAddSection: () => void;
  onAddBlockAfter: (sectionId: string, afterOrder: number) => void;
  onSectionTitleSave: (sectionId: string, title: string) => void;
  onBlockTypeChange: (blockId: string, blockType: MeriterBlockType) => void;
  onToggleBlockProposalsLocked: (blockId: string, locked: boolean) => void;
  onRemoveSection: (sectionId: string, confirmLossOfOfficial: boolean) => void;
  onRemoveBlock: (blockId: string, confirmLossOfOfficial: boolean) => void;
}

export const DocumentStructureContext = createContext<DocumentStructureContextValue | null>(null);

export function useDocumentStructure(): DocumentStructureContextValue | null {
  return useContext(DocumentStructureContext);
}

function parseSections(sections: unknown): DocSectionSlice[] {
  return Array.isArray(sections) ? (sections as DocSectionSlice[]) : [];
}

function countBlocks(sections: DocSectionSlice[]): number {
  return sections.reduce((n, s) => n + (Array.isArray(s.blocks) ? s.blocks.length : 0), 0);
}

export interface DocumentStructureProviderProps {
  documentId: string;
  documentUpdatedAt?: string | Date | null;
  sections: unknown;
  canManageDocument: boolean;
  /** Legacy toolbar — prefer structure mode toggle (FE-UX-2). */
  showStructureToolbar?: boolean;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  children: ReactNode;
}

export function DocumentStructureProvider({
  documentId,
  documentUpdatedAt,
  sections: sectionsRaw,
  canManageDocument,
  showStructureToolbar = false,
  addToast,
  children,
}: DocumentStructureProviderProps) {
  const tStructure = useTranslations('pages.documents.structure');
  const utils = trpc.useUtils();
  const [structureMode, setStructureMode] = useState(false);

  const invalidateDocument = useCallback(async () => {
    await utils.documents.getById.invalidate({ id: documentId });
  }, [documentId, utils.documents.getById]);

  const onStructureError = useCallback(
    (err: { message: string }) => {
      addToast(err.message, 'error');
    },
    [addToast],
  );

  const addSectionMutation = trpc.documents.addSection.useMutation({
    onSuccess: invalidateDocument,
    onError: onStructureError,
  });
  const addBlockMutation = trpc.documents.addBlock.useMutation({
    onSuccess: invalidateDocument,
    onError: onStructureError,
  });
  const updateSectionMutation = trpc.documents.updateSection.useMutation({
    onSuccess: invalidateDocument,
    onError: onStructureError,
  });
  const updateBlockMutation = trpc.documents.updateBlock.useMutation({
    onSuccess: invalidateDocument,
    onError: onStructureError,
  });
  const removeSectionMutation = trpc.documents.removeSection.useMutation({
    onSuccess: invalidateDocument,
    onError: onStructureError,
  });
  const removeBlockMutation = trpc.documents.removeBlock.useMutation({
    onSuccess: invalidateDocument,
    onError: onStructureError,
  });

  const sections = parseSections(sectionsRaw);
  const canRemoveSection = sections.length > 1;
  const canRemoveBlock = countBlocks(sections) > 1;

  const structureConcurrency = useMemo(() => {
    if (!documentUpdatedAt) {
      return {};
    }
    const parsed = new Date(documentUpdatedAt);
    if (Number.isNaN(parsed.getTime())) {
      return {};
    }
    return { expectedUpdatedAt: parsed };
  }, [documentUpdatedAt]);

  const structureBusy =
    addSectionMutation.isPending ||
    addBlockMutation.isPending ||
    updateSectionMutation.isPending ||
    updateBlockMutation.isPending ||
    removeSectionMutation.isPending ||
    removeBlockMutation.isPending;

  const toggleStructureMode = useCallback(() => {
    setStructureMode((v) => !v);
  }, []);

  const documentStructureActions: DocumentStructureToolbarActions | undefined =
    canManageDocument
      ? {
          onAddSection: () =>
            addSectionMutation.mutate({ documentId, ...structureConcurrency }),
          onAddBlock: () => {
            const sorted = [...sections].sort((a, b) => a.order - b.order);
            const targetSection = sorted[sorted.length - 1];
            if (!targetSection) {
              addToast(tStructure('noSectionForBlock'), 'error');
              return;
            }
            const blocks = targetSection.blocks ?? [];
            const maxOrder =
              blocks.length > 0 ? Math.max(...blocks.map((b) => b.order ?? 0)) : -1;
            addBlockMutation.mutate({
              documentId,
              sectionId: targetSection.id,
              blockType: 'paragraph',
              order: maxOrder + 1,
              ...structureConcurrency,
            });
          },
          disabled: structureBusy,
        }
      : undefined;

  const value = useMemo<DocumentStructureContextValue | null>(
    () =>
      canManageDocument
        ? {
            canManageDocument: true,
            structureMode,
            setStructureMode,
            toggleStructureMode,
            structureBusy,
            canRemoveSection,
            canRemoveBlock,
            onAddSection: () =>
              addSectionMutation.mutate({ documentId, ...structureConcurrency }),
            onAddBlockAfter: (sectionId, afterOrder) =>
              addBlockMutation.mutate({
                documentId,
                sectionId,
                blockType: 'paragraph',
                order: afterOrder,
                ...structureConcurrency,
              }),
            onSectionTitleSave: (sectionId, title) =>
              updateSectionMutation.mutate({
                documentId,
                sectionId,
                title,
                ...structureConcurrency,
              }),
            onBlockTypeChange: (blockId, blockType) =>
              updateBlockMutation.mutate({
                documentId,
                blockId,
                blockType,
                ...structureConcurrency,
              }),
            onToggleBlockProposalsLocked: (blockId, locked) =>
              updateBlockMutation.mutate({
                documentId,
                blockId,
                proposalsLocked: locked,
                ...structureConcurrency,
              }),
            onRemoveSection: (sectionId, confirmLossOfOfficial) =>
              removeSectionMutation.mutate({
                documentId,
                sectionId,
                confirmLossOfOfficial,
                ...structureConcurrency,
              }),
            onRemoveBlock: (blockId, confirmLossOfOfficial) =>
              removeBlockMutation.mutate({
                documentId,
                blockId,
                confirmLossOfOfficial,
                ...structureConcurrency,
              }),
          }
        : null,
    [
      canManageDocument,
      structureMode,
      structureBusy,
      canRemoveSection,
      canRemoveBlock,
      documentId,
      structureConcurrency,
      addSectionMutation,
      addBlockMutation,
      updateSectionMutation,
      updateBlockMutation,
      removeSectionMutation,
      removeBlockMutation,
      toggleStructureMode,
    ],
  );

  return (
    <DocumentStructureContext.Provider value={value}>
      {showStructureToolbar && documentStructureActions ? (
        <div className="overflow-hidden rounded-xl border border-base-300">
          <DocumentStructureToolbar actions={documentStructureActions} />
        </div>
      ) : null}
      {children}
    </DocumentStructureContext.Provider>
  );
}
