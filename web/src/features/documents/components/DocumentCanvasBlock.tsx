'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { Community } from '@meriter/shared-types';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DocumentProposeComposer } from '@/features/documents/components/DocumentProposeComposer';
import { DocumentBlockMobileActions } from '@/features/documents/components/DocumentCanvasMobileSheet';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import { DocumentVariantSuggestion } from '@/features/documents/components/DocumentVariantSuggestion';
import {
  MAX_VISIBLE_VARIANTS,
  VARIANT_LIST_SCROLL_THRESHOLD,
  formatWaveRemaining,
  officialReasonLabelKey,
  parseDateMs,
  type DocBlock,
  type DocTranslate,
} from '@/features/documents/lib/document-canvas-shared';
import { parseVariantReferencesFromApi } from '@/features/documents/types/document-variant-reference';
import { DocumentBlockGutter } from '@/features/documents/components/DocumentBlockGutter';
import { useDocumentStructure } from '@/features/documents/context/DocumentStructureContext';
import { cn } from '@/lib/utils';

function officialTypographyClass(blockType: string): string {
  switch (blockType) {
    case 'heading':
      return 'text-xl font-semibold tracking-tight text-base-content';
    case 'quote':
      return 'border-l-2 border-base-content/25 pl-4 italic text-base-content/85';
    case 'list-bullet':
    case 'list-numbered':
      return 'text-base leading-relaxed [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5';
    default:
      return 'text-base leading-relaxed text-base-content/95';
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
  quotaRemaining,
  walletBalance,
  userId,
  addToast,
  t,
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
  const [showAllVariants, setShowAllVariants] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [waveCountdown, setWaveCountdown] = useState('');

  const variants = variantsQuery.data ?? [];
  const userOpenVariant = variants.find((v) => v.status === 'open' && v.proposedBy === userId);

  useEffect(() => {
    if (!variantsQuery.isSuccess) return;
    if (userOpenVariant) {
      setVariantsExpanded(true);
    }
  }, [variantsQuery.isSuccess, userOpenVariant?.id]);

  const waveStartMs = parseDateMs(block.currentWaveStartedAt);
  const waveEndsAtMs =
    waveStartMs != null ? waveStartMs + votingDurationHours * 3_600_000 : null;
  const waveActive =
    waveEndsAtMs != null &&
    waveEndsAtMs > Date.now() &&
    variants.some((v) => v.status === 'open');

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
  const isFocused = focus?.focusedBlockId === block.id;

  const displayedVariants =
    variantsExpanded && showAllVariants
      ? variants
      : variantsExpanded
        ? variants.slice(0, MAX_VISIBLE_VARIANTS)
        : [];
  const hiddenVariantCount = variantsExpanded
    ? Math.max(0, variants.length - displayedVariants.length)
    : variants.length;

  const openMobilePropose = (e: React.MouseEvent) => {
    e.stopPropagation();
    focus?.setFocusedBlockId(block.id);
    focus?.openMobileSheet({ kind: 'propose' });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => focus?.setFocusedBlockId(block.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          focus?.setFocusedBlockId(block.id);
        }
      }}
      className={cn(
        'group/block relative grid cursor-pointer gap-3 rounded-lg outline-none transition-shadow',
        structureMode ? 'grid-cols-[auto_1fr]' : 'grid-cols-1',
        waveActive && !structureMode && 'border-l-2 border-primary pl-3 -ml-0.5',
        waveActive && structureMode && 'border-l-2 border-primary',
        isFocused && isDesktop && 'ring-1 ring-primary/35',
      )}
    >
      {structureMode ? (
        <DocumentBlockGutter
          sectionId={sectionId}
          blockId={block.id}
          blockType={block.blockType}
          blockHasOfficial={hasOfficialContent}
          sectionHasOfficial={sectionHasOfficial}
          showRemoveSection={showRemoveSection}
        />
      ) : null}

      <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-end gap-2 opacity-0 transition-opacity group-hover/block:opacity-100 focus-within:opacity-100">
          {reasonKey ? (
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
            className={officialTypographyClass(block.blockType)}
          />
        ) : (
          <p className="text-sm italic text-base-content/45">{t('noOfficialYet')}</p>
        )}

        {variants.length > 0 ? (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-medium text-base-content/65 hover:text-base-content"
              onClick={(e) => {
                e.stopPropagation();
                setVariantsExpanded((v) => !v);
                if (variantsExpanded) setShowAllVariants(false);
              }}
            >
              <ChevronDown
                size={14}
                className={cn('transition-transform', variantsExpanded && 'rotate-180')}
              />
              {tCanvas('variantsToggle', { count: variants.length })}
            </button>

            {variantsExpanded ? (
              variantsQuery.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
              ) : (
                <>
                  <ul
                    className={cn(
                      'flex flex-col gap-2',
                      displayedVariants.length > VARIANT_LIST_SCROLL_THRESHOLD &&
                        'max-h-[min(32rem,70vh)] overflow-y-auto overscroll-contain pr-1',
                    )}
                    aria-label={
                      displayedVariants.length > VARIANT_LIST_SCROLL_THRESHOLD
                        ? tCanvas('variantsScrollRegion')
                        : undefined
                    }
                  >
                    {displayedVariants.map((v) => (
                      <DocumentVariantSuggestion
                        key={v.id}
                        officialHtml={block.officialContent ?? ''}
                        variant={{
                          id: v.id,
                          documentId: v.documentId,
                          blockId: v.blockId,
                          content: v.content,
                          proposedBy: v.proposedBy,
                          status: v.status,
                          rating: v.rating ?? 0,
                          references: parseVariantReferencesFromApi(v.references),
                        }}
                        documentId={documentId}
                        blockId={block.id}
                        docMode={docMode}
                        docAllowDownvotes={docAllowDownvotes}
                        canManageDocument={canManageDocument}
                        community={community}
                        quotaRemaining={quotaRemaining}
                        walletBalance={walletBalance}
                        userId={userId}
                        addToast={addToast}
                        t={t}
                      />
                    ))}
                  </ul>
                  {hiddenVariantCount > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg px-2 text-xs text-base-content/60"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAllVariants(true);
                      }}
                    >
                      {tCanvas('variantsMore', { count: hiddenVariantCount })}
                    </Button>
                  ) : null}
                </>
              )
            ) : null}
          </div>
        ) : null}

        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          {userOpenVariant ? (
            <p className="text-xs text-base-content/55">{tCanvas('yourOpenVariant')}</p>
          ) : isDesktop ? (
            proposeOpen ? (
              <DocumentProposeComposer
                blockId={block.id}
                showCancel
                onCancel={() => setProposeOpen(false)}
                onSuccess={() => {
                  setProposeOpen(false);
                  setVariantsExpanded(true);
                }}
              />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2 text-xs text-base-content/60 hover:text-primary"
                onClick={() => setProposeOpen(true)}
              >
                {tCanvas('proposeCta')}
              </Button>
            )
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
          )}
        </div>
      </div>
    </div>
  );
}
