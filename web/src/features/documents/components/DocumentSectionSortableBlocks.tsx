'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Community } from '@meriter/shared-types';
import { DocumentCanvasBlock } from '@/features/documents/components/DocumentCanvasBlock';
import { DocumentBlockInsertSlot } from '@/features/documents/components/DocumentBlockInsertSlot';
import { useDocumentStructure } from '@/features/documents/context/DocumentStructureContext';
import type { DocBlock, DocTranslate } from '@/features/documents/lib/document-canvas-shared';
import { cn } from '@/lib/utils';

export interface DocumentSectionSortableBlocksProps {
  sectionId: string;
  sectionTitle: string;
  sectionHasOfficial: boolean;
  blocks: DocBlock[];
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
}

function blockHasOfficialContent(block: DocBlock): boolean {
  return (block.officialContent ?? '').trim().length > 0;
}

function blocksOrderKey(blocks: DocBlock[]): string {
  return blocks.map((b) => `${b.id}:${b.order ?? 0}`).join('|');
}

interface SortableBlockRowProps {
  block: DocBlock;
  blockIndex: number;
  sectionId: string;
  sectionTitle: string;
  sectionHasOfficial: boolean;
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
  dragEnabled: boolean;
}

function SortableBlockRow({
  block,
  blockIndex,
  sectionId,
  sectionTitle,
  sectionHasOfficial,
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
  dragEnabled,
}: SortableBlockRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: !dragEnabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'space-y-2',
        isDragging && 'relative z-20 rounded-lg bg-base-300/15 ring-1 ring-primary/35 shadow-sm',
      )}
    >
      <DocumentCanvasBlock
        documentId={documentId}
        sectionId={sectionId}
        sectionTitle={sectionTitle}
        showRemoveSection={blockIndex === 0}
        hasOfficialContent={blockHasOfficialContent(block)}
        sectionHasOfficial={sectionHasOfficial}
        docMode={docMode}
        variantCost={variantCost}
        votingDurationHours={votingDurationHours}
        docAllowDownvotes={docAllowDownvotes}
        canManageDocument={canManageDocument}
        community={community}
        block={block}
        quotaRemaining={quotaRemaining}
        walletBalance={walletBalance}
        globalWalletBalance={globalWalletBalance}
        userId={userId}
        addToast={addToast}
        t={t}
        dragHandleProps={dragEnabled ? { ...attributes, ...listeners } : undefined}
      />
      <DocumentBlockInsertSlot sectionId={sectionId} afterOrder={(block.order ?? blockIndex) + 1} />
    </div>
  );
}

export function DocumentSectionSortableBlocks(props: DocumentSectionSortableBlocksProps) {
  const {
    sectionId,
    sectionTitle,
    sectionHasOfficial,
    blocks,
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
  } = props;

  const structure = useDocumentStructure();
  const [orderedBlocks, setOrderedBlocks] = useState(blocks);
  const serverOrderKey = useMemo(() => blocksOrderKey(blocks), [blocks]);

  useEffect(() => {
    setOrderedBlocks(blocks);
  }, [serverOrderKey, blocks]);

  const dragEnabled = (structure?.structureMode ?? false) && orderedBlocks.length > 1 && !structure?.structureBusy;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !structure) {
      return;
    }

    const oldIndex = orderedBlocks.findIndex((b) => b.id === active.id);
    const newIndex = orderedBlocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const previous = orderedBlocks;
    const next = arrayMove(orderedBlocks, oldIndex, newIndex).map((b, order) => ({
      ...b,
      order,
    }));
    setOrderedBlocks(next);
    void structure.onReorderBlocks(sectionId, next.map((b) => b.id)).catch(() => {
      setOrderedBlocks(previous);
    });
  };

  if (!dragEnabled) {
    return (
      <>
        {orderedBlocks.map((block, blockIndex) => (
          <div key={block.id} className="space-y-2">
            <DocumentCanvasBlock
              documentId={documentId}
              sectionId={sectionId}
              sectionTitle={sectionTitle}
              showRemoveSection={blockIndex === 0}
              hasOfficialContent={blockHasOfficialContent(block)}
              sectionHasOfficial={sectionHasOfficial}
              docMode={docMode}
              variantCost={variantCost}
              votingDurationHours={votingDurationHours}
              docAllowDownvotes={docAllowDownvotes}
              canManageDocument={canManageDocument}
              community={community}
              block={block}
              quotaRemaining={quotaRemaining}
              walletBalance={walletBalance}
              globalWalletBalance={globalWalletBalance}
              userId={userId}
              addToast={addToast}
              t={t}
            />
            <DocumentBlockInsertSlot sectionId={sectionId} afterOrder={(block.order ?? blockIndex) + 1} />
          </div>
        ))}
      </>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        {orderedBlocks.map((block, blockIndex) => (
          <SortableBlockRow
            key={block.id}
            block={block}
            blockIndex={blockIndex}
            sectionId={sectionId}
            sectionTitle={sectionTitle}
            sectionHasOfficial={sectionHasOfficial}
            documentId={documentId}
            docMode={docMode}
            variantCost={variantCost}
            votingDurationHours={votingDurationHours}
            docAllowDownvotes={docAllowDownvotes}
            canManageDocument={canManageDocument}
            community={community}
            quotaRemaining={quotaRemaining}
            walletBalance={walletBalance}
            globalWalletBalance={globalWalletBalance}
            userId={userId}
            addToast={addToast}
            t={t}
            dragEnabled={dragEnabled}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
