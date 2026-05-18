'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { MeriterBlockType } from '@/features/documents/types/document-block';
import type { DocBlock, DocSection } from '@/features/documents/lib/document-canvas-shared';
import type { DocumentDraft } from '@/features/documents/lib/document-draft';
import {
  DocumentStructureContext,
  type DocumentStructureContextValue,
} from '@/features/documents/context/DocumentStructureContext';

interface DocumentDraftContextValue {
  draft: DocumentDraft;
  setDraft: (draft: DocumentDraft) => void;
  onBlockContentChange: (blockId: string, officialContent: string) => void;
  disabled?: boolean;
  blockPlaceholder?: string;
}

const DocumentDraftContext = createContext<DocumentDraftContextValue | null>(null);

export function useDocumentDraft(): DocumentDraftContextValue {
  const ctx = useContext(DocumentDraftContext);
  if (!ctx) {
    throw new Error('useDocumentDraft must be used within DocumentDraftStructureProvider');
  }
  return ctx;
}

function countBlocks(sections: DocSection[]): number {
  return sections.reduce((n, s) => n + (Array.isArray(s.blocks) ? s.blocks.length : 0), 0);
}

function cloneSections(sections: DocSection[]): DocSection[] {
  return sections.map((sec) => ({
    ...sec,
    blocks: [...(sec.blocks ?? [])].map((b) => ({ ...b })),
  }));
}

export interface DocumentDraftStructureProviderProps {
  value: DocumentDraft;
  onChange: (draft: DocumentDraft) => void;
  disabled?: boolean;
  blockPlaceholder?: string;
  children: ReactNode;
}

export function DocumentDraftStructureProvider({
  value,
  onChange,
  disabled = false,
  blockPlaceholder,
  children,
}: DocumentDraftStructureProviderProps) {
  const sections = value.sections;
  const canRemoveSection = sections.length > 1;
  const canRemoveBlock = countBlocks(sections) > 1;

  const updateSections = useCallback(
    (updater: (prev: DocSection[]) => DocSection[]) => {
      onChange({ sections: updater(cloneSections(sections)) });
    },
    [onChange, sections],
  );

  const onBlockContentChange = useCallback(
    (blockId: string, officialContent: string) => {
      updateSections((prev) =>
        prev.map((sec) => ({
          ...sec,
          blocks: (sec.blocks ?? []).map((b) =>
            b.id === blockId ? { ...b, officialContent } : b,
          ),
        })),
      );
    },
    [updateSections],
  );

  const structureValue = useMemo<DocumentStructureContextValue>(
    () => ({
      canManageDocument: true,
      structureMode: true,
      setStructureMode: () => {},
      toggleStructureMode: () => {},
      structureBusy: disabled,
      canRemoveSection,
      canRemoveBlock,
      onAddSection: () => {
        const maxOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.order ?? 0)) : -1;
        updateSections((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            title: '',
            order: maxOrder + 1,
            blocks: [
              {
                id: crypto.randomUUID(),
                order: 0,
                blockType: 'paragraph',
                officialContent: '<p></p>',
                officialContentReason: 'initial',
              },
            ],
          },
        ]);
      },
      onAddBlockAfter: (sectionId, afterOrder) => {
        updateSections((prev) =>
          prev.map((sec) => {
            if (sec.id !== sectionId) return sec;
            const blocks = [...(sec.blocks ?? [])];
            const insertOrder = afterOrder <= 0 ? 0 : afterOrder;
            const shifted = blocks.map((b) =>
              (b.order ?? 0) >= insertOrder ? { ...b, order: (b.order ?? 0) + 1 } : b,
            );
            return {
              ...sec,
              blocks: [
                ...shifted,
                {
                  id: crypto.randomUUID(),
                  order: insertOrder,
                  blockType: 'paragraph',
                  officialContent: '<p></p>',
                  officialContentReason: 'initial',
                },
              ],
            };
          }),
        );
      },
      onSectionTitleSave: (sectionId, title) => {
        updateSections((prev) =>
          prev.map((sec) => (sec.id === sectionId ? { ...sec, title } : sec)),
        );
      },
      onBlockTypeChange: (blockId, blockType) => {
        updateSections((prev) =>
          prev.map((sec) => ({
            ...sec,
            blocks: (sec.blocks ?? []).map((b) =>
              b.id === blockId ? { ...b, blockType } : b,
            ),
          })),
        );
      },
      onRemoveSection: (sectionId) => {
        updateSections((prev) => {
          const filtered = prev.filter((s) => s.id !== sectionId);
          return filtered.map((s, i) => ({ ...s, order: i }));
        });
      },
      onRemoveBlock: (blockId) => {
        updateSections((prev) =>
          prev.map((sec) => {
            const blocks = (sec.blocks ?? []).filter((b) => b.id !== blockId);
            return {
              ...sec,
              blocks: blocks.map((b, i) => ({ ...b, order: i })),
            };
          }),
        );
      },
    }),
    [
      canRemoveBlock,
      canRemoveSection,
      disabled,
      sections,
      updateSections,
    ],
  );

  const draftContext = useMemo(
    () => ({
      draft: value,
      setDraft: onChange,
      onBlockContentChange,
      disabled,
      blockPlaceholder,
    }),
    [value, onChange, onBlockContentChange, disabled, blockPlaceholder],
  );

  return (
    <DocumentDraftContext.Provider value={draftContext}>
      <DocumentStructureContext.Provider value={structureValue}>
        {children}
      </DocumentStructureContext.Provider>
    </DocumentDraftContext.Provider>
  );
}
