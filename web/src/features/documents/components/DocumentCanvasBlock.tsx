'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import type { Community } from '@meriter/shared-types';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { DocumentProposeComposer } from '@/features/documents/components/DocumentProposeComposer';
import { DocumentBlockMobileActions } from '@/features/documents/components/DocumentCanvasMobileSheet';
import { DocumentBlockProposalsPanel } from '@/features/documents/components/DocumentBlockProposalsPanel';
import { DocumentBlockGovernanceToolbar } from '@/features/documents/components/DocumentBlockGovernanceToolbar';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import {
  countActiveProposalVariants,
  isPendingOfficialManualPick,
} from '@/features/documents/lib/document-proposal-utils';
import {
  formatWaveRemaining,
  officialReasonLabelKey,
  parseDateMs,
  type DocBlock,
  type DocTranslate,
} from '@/features/documents/lib/document-canvas-shared';
import { DocumentBlockStructureBar } from '@/features/documents/components/DocumentBlockStructureBar';
import { useDocumentStructure } from '@/features/documents/context/DocumentStructureContext';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

function officialTypographyClass(blockType: string): string {
  switch (blockType) {
    case 'quote':
      return 'border-l-2 border-base-content/25 pl-4 italic text-base-content/85';
    case 'list-bullet':
    case 'list-numbered':
      return '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5';
    default:
      return 'text-base-content/95';
  }
}

export interface DocumentCanvasBlockProps {
  documentId: string;
  sectionId: string;
  sectionTitle: string;
  showRemoveSection: boolean;
  hasOfficialContent: boolean;
  sectionHasOfficial: boolean;
  docMode: 'manual' | 'auto';
  variantCost: number;
  votingDurationHours: number;
  docAllowDownvotes: boolean;
  canManageDocument: boolean;
  community: Community | null;
  block: DocBlock;
  quotaRemaining: number;
  walletBalance: number;
  globalWalletBalance: number;
  userId: string;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  t: DocTranslate;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

export function DocumentCanvasBlock({
  documentId,
  sectionId,
  showRemoveSection,
  hasOfficialContent,
  sectionHasOfficial,
  docMode,
  votingDurationHours,
  docAllowDownvotes,
  canManageDocument,
  community,
  block,
  userId,
  addToast,
  t,
  dragHandleProps,
}: DocumentCanvasBlockProps) {
  const tCanvas = useTranslations('pages.documents.canvas');
  const structure = useDocumentStructure();
  const structureMode = structure?.structureMode ?? false;
  const focus = useDocumentCanvasFocus();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const variantsQuery = trpc.documentVariants.listByBlock.useQuery(
    { documentId, blockId: block.id },
    { enabled: !!documentId && !!block.id },
  );

  const [variantsExpanded, setVariantsExpanded] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [waveCountdown, setWaveCountdown] = useState('');

  const variants = variantsQuery.data ?? [];
  const userOpenVariant = variants.find((v) => v.status === 'open' && v.proposedBy === userId);

  const waveStartMs = parseDateMs(block.currentWaveStartedAt);
  const waveEndsAtMs =
    waveStartMs != null ? waveStartMs + votingDurationHours * 3_600_000 : null;
  const waveActive =
    waveEndsAtMs != null &&
    waveEndsAtMs > Date.now() &&
    variants.some((v) => v.status === 'open');

  const activeProposalCount = countActiveProposalVariants(variants);
  const pendingOfficialPick = isPendingOfficialManualPick(docMode, waveActive, variants);
  const proposalsLocked = block.proposalsLocked === true;
  const canProposeVariant = !structureMode && (!proposalsLocked || canManageDocument);
  const showProposalsSection = activeProposalCount > 0 || waveActive || pendingOfficialPick;
  const showBlockActions = !structureMode && (canProposeVariant || canManageDocument);

  useEffect(() => {
    if (!variantsQuery.isSuccess) return;
    if (userOpenVariant) {
      setVariantsExpanded(true);
    }
  }, [variantsQuery.isSuccess, userOpenVariant?.id]);

  useEffect(() => {
    if (!waveActive || waveEndsAtMs == null) {
      setWaveCountdown('');
      return;
    }
    const tick = () => setWaveCountdown(formatWaveRemaining(waveEndsAtMs));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [waveActive, waveEndsAtMs]);

  const official = (block.officialContent ?? '').trim();
  const reasonKey = officialReasonLabelKey(block.officialContentReason);

  const openMobilePropose = (e: React.MouseEvent) => {
    e.stopPropagation();
    focus?.setFocusedBlockId(block.id);
    focus?.openMobileSheet({ kind: 'propose' });
  };

  return (
    <div
      className={cn(
        'group/block relative grid gap-3 rounded-lg',
        'grid-cols-1',
        waveActive && !structureMode && 'border-l-2 border-primary pl-3 -ml-0.5',
        waveActive && structureMode && 'border-l-2 border-primary',
      )}
    >
      <div className="min-w-0">
        {structureMode ? (
          <DocumentBlockStructureBar
            sectionId={sectionId}
            blockId={block.id}
            blockType={block.blockType}
            blockHasOfficial={hasOfficialContent}
            sectionHasOfficial={sectionHasOfficial}
            showRemoveSection={showRemoveSection}
            proposalsLocked={block.proposalsLocked === true}
            dragHandleProps={dragHandleProps}
          />
        ) : null}

        <div className="mb-1 flex items-start justify-end gap-2 opacity-0 transition-opacity group-hover/block:opacity-100 focus-within:opacity-100">
          {proposalsLocked && !structureMode ? (
            <Badge
              variant="outline"
              className="mr-auto rounded-md px-1.5 py-0 text-[10px] font-normal text-base-content/50"
            >
              {tCanvas('blockProposalsLocked')}
            </Badge>
          ) : reasonKey ? (
            <Badge
              variant="outline"
              className="mr-auto rounded-md px-1.5 py-0 text-[10px] font-normal text-base-content/50"
            >
              {t(reasonKey)}
            </Badge>
          ) : (
            <span className="mr-auto" />
          )}
          {waveActive ? (
            <span className="text-[11px] text-primary/80 lg:hidden">
              {tCanvas('votingOpen')}
              {waveCountdown ? ` · ${t('waveEndsIn', { time: waveCountdown })}` : ''}
            </span>
          ) : null}
          <DocumentBlockMobileActions blockId={block.id} />
        </div>

        {official ? (
          <DocumentRichContent
            html={block.officialContent ?? ''}
            blockType={block.blockType}
            className={officialTypographyClass(block.blockType)}
          />
        ) : (
          <p className="text-sm italic text-base-content/45">{t('noOfficialYet')}</p>
        )}

        {showProposalsSection ? (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-medium text-base-content/65 hover:text-base-content"
              onClick={() => setVariantsExpanded((v) => !v)}
            >
              <ChevronDown
                size={14}
                className={cn('transition-transform', variantsExpanded && 'rotate-180')}
              />
              {activeProposalCount > 0
                ? tCanvas('variantsToggle', { count: activeProposalCount })
                : tCanvas('governanceFinalize')}
            </button>

            {variantsExpanded ? (
              <DocumentBlockProposalsPanel
                documentId={documentId}
                block={block}
                docMode={docMode}
                docAllowDownvotes={docAllowDownvotes}
                canManageDocument={canManageDocument}
                community={community}
                votingDurationHours={votingDurationHours}
                waveActive={waveActive}
                waveEndsAtMs={waveEndsAtMs}
                userId={userId}
                addToast={addToast}
                t={t}
              />
            ) : null}
          </div>
        ) : null}

        {showBlockActions ? (
          <div className="mt-4 space-y-2 border-t border-base-300/35 pt-3">
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-base-300/25 bg-base-300/10 px-2 py-1">
              {canProposeVariant && !userOpenVariant && !(isDesktop && proposeOpen) ? (
                isDesktop ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg px-2 text-xs text-base-content/60 hover:text-primary"
                    onClick={() => setProposeOpen(true)}
                  >
                    {tCanvas('proposeCta')}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg px-2 text-xs text-base-content/60 hover:text-primary"
                    onClick={openMobilePropose}
                  >
                    {tCanvas('proposeCta')}
                  </Button>
                )
              ) : null}
              {canManageDocument ? (
                <DocumentBlockGovernanceToolbar
                  documentId={documentId}
                  blockId={block.id}
                  waveActive={waveActive}
                  showCloseVoting
                  variant="ghost"
                  onCloseVotingSuccess={() => addToast(t('closeVotingSuccess'), 'success')}
                  onCloseVotingError={(message) => addToast(message, 'error')}
                />
              ) : null}
            </div>
            {userOpenVariant ? (
              <p className="text-xs text-base-content/55">{tCanvas('yourOpenVariant')}</p>
            ) : isDesktop && proposeOpen ? (
              <DocumentProposeComposer
                blockId={block.id}
                initialContent={block.officialContent ?? ''}
                showCancel
                onCancel={() => setProposeOpen(false)}
                onSuccess={() => {
                  setProposeOpen(false);
                  setVariantsExpanded(true);
                }}
              />
            ) : null}
          </div>
        ) : proposalsLocked && !structureMode && !canManageDocument ? (
          <p className="mt-3 text-xs text-base-content/50">{tCanvas('proposalsLockedHint')}</p>
        ) : null}
      </div>
    </div>
  );
}
