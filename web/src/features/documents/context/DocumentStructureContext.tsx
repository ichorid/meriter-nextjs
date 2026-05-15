'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import {
  DocumentStructureToolbar,
} from '@/components/molecules/RichTextEditor';
import type { DocumentStructureToolbarActions } from '@/components/molecules/RichTextEditor';
import type { MeriterBlockType } from '@/features/documents/types/document-block';

export interface DocSectionSlice {
  id: string;
  title?: string;
  order: number;
  blocks?: { id: string }[];
}

interface DocumentStructureContextValue {
  canManageDocument: boolean;
  structureBusy: boolean;
  canRemoveSection: boolean;
  canRemoveBlock: boolean;
  onSectionTitleSave: (sectionId: string, title: string) => void;
  onBlockTypeChange: (blockId: string, blockType: MeriterBlockType) => void;
  onRemoveSection: (sectionId: string, confirmLossOfOfficial: boolean) => void;
  onRemoveBlock: (blockId: string, confirmLossOfOfficial: boolean) => void;
}

const DocumentStructureContext = createContext<DocumentStructureContextValue | null>(
  null,
);

export function useDocumentStructure(): DocumentStructureContextValue | null {
  return useContext(DocumentStructureContext);
}

function parseSections(sections: unknown): DocSectionSlice[] {
  return Array.isArray(sections) ? (sections as DocSectionSlice[]) : [];
}

function countBlocks(sections: DocSectionSlice[]): number {
  return sections.reduce((n, s) => n + (Array.isArray(s.blocks) ? s.blocks.length : 0), 0);
}

function pickSectionForNewBlock(sections: DocSectionSlice[]): DocSectionSlice | null {
  if (sections.length === 0) return null;
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  return sorted[sorted.length - 1] ?? null;
}

export interface DocumentStructureProviderProps {
  documentId: string;
  documentUpdatedAt?: string | Date | null;
  sections: unknown;
  canManageDocument: boolean;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  children: ReactNode;
}

export function DocumentStructureProvider({
  documentId,
  documentUpdatedAt,
  sections: sectionsRaw,
  canManageDocument,
  addToast,
  children,
}: DocumentStructureProviderProps) {
  const tStructure = useTranslations('pages.documents.structure');
  const utils = trpc.useUtils();

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

  const documentStructureActions: DocumentStructureToolbarActions | undefined =
    canManageDocument
      ? {
          onAddSection: () =>
            addSectionMutation.mutate({ documentId, ...structureConcurrency }),
          onAddBlock: () => {
            const targetSection = pickSectionForNewBlock(sections);
            if (!targetSection) {
              addToast(tStructure('noSectionForBlock'), 'error');
              return;
            }
            addBlockMutation.mutate({
              documentId,
              sectionId: targetSection.id,
              blockType: 'paragraph',
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
            structureBusy,
            canRemoveSection,
            canRemoveBlock,
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
      structureBusy,
      canRemoveSection,
      canRemoveBlock,
      documentId,
      structureConcurrency,
      updateSectionMutation,
      updateBlockMutation,
      removeSectionMutation,
      removeBlockMutation,
    ],
  );

  return (
    <DocumentStructureContext.Provider value={value}>
      {documentStructureActions ? (
        <div className="overflow-hidden rounded-xl border border-base-300">
          <DocumentStructureToolbar actions={documentStructureActions} />
        </div>
      ) : null}
      {children}
    </DocumentStructureContext.Provider>
  );
}
