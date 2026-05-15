'use client';

import { useTranslations } from 'next-intl';
import type { Community } from '@meriter/shared-types';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { DocumentVariantDiffHighlight } from '@/features/documents/components/DocumentVariantDiffHighlight';
import { DocumentVariantReferencesList } from '@/features/documents/components/DocumentVariantReferencesList';
import { variantStatusLabelKey, type DocTranslate } from '@/features/documents/lib/document-canvas-shared';
import type { DocumentVariantReference } from '@/features/documents/types/document-variant-reference';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import { cn } from '@/lib/utils';

export interface DocumentVariantSuggestionProps {
  variant: {
    id: string;
    documentId: string;
    blockId: string;
    content: string;
    proposedBy: string;
    status: 'open' | 'closed-winner' | 'closed-not-winner' | 'applied' | 'withdrawn';
    rating: number;
    references: DocumentVariantReference[];
  };
  documentId: string;
  blockId: string;
  docMode: 'manual' | 'auto';
  docAllowDownvotes: boolean;
  canManageDocument: boolean;
  community: Community | null;
  quotaRemaining: number;
  walletBalance: number;
  userId: string;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  t: DocTranslate;
  officialHtml?: string;
  className?: string;
}

export function DocumentVariantSuggestion({
  variant,
  documentId,
  blockId,
  docMode,
  canManageDocument,
  userId,
  addToast,
  t,
  officialHtml = '',
  className,
}: DocumentVariantSuggestionProps) {
  const tCanvas = useTranslations('pages.documents.canvas');
  const focus = useDocumentCanvasFocus();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const utils = trpc.useUtils();

  const withdrawMutation = trpc.documentVariants.withdraw.useMutation({
    onSuccess: async () => {
      await utils.documents.getById.invalidate({ id: documentId });
      await utils.documentVariants.listByBlock.invalidate({ documentId, blockId });
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const isOpen = variant.status === 'open';
  const isOwnOpen = isOpen && variant.proposedBy === userId;
  const isSelectedInRail = focus?.focusedVariantId === variant.id;

  const openVoteInRail = () => {
    focus?.setFocusedBlockId(blockId);
    focus?.setFocusedVariantId(variant.id);
  };

  return (
    <li
      className={cn(
        'rounded-lg border-l-2 py-2.5 pl-3 pr-2 transition-colors',
        isSelectedInRail && isDesktop
          ? 'border-primary bg-primary/5'
          : 'border-primary/35 bg-base-300/15',
        className,
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px] font-normal">
          {t(variantStatusLabelKey(variant.status))}
        </Badge>
        <span className="text-[11px] text-base-content/55">
          {t('rating', { rating: variant.rating ?? 0 })}
        </span>
        {isOwnOpen ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-6 rounded-md px-2 text-[10px]"
            disabled={withdrawMutation.isPending}
            onClick={(e) => {
              e.stopPropagation();
              withdrawMutation.mutate({ variantId: variant.id });
            }}
          >
            {t('withdraw')}
          </Button>
        ) : null}
      </div>

      <div className="mb-2 max-h-32 overflow-y-auto">
        <DocumentVariantDiffHighlight
          officialHtml={officialHtml}
          variantHtml={variant.content}
          contentClassName="text-sm leading-relaxed"
        />
      </div>

      <DocumentVariantReferencesList references={variant.references} className="mb-2 text-xs" />

      {isOpen && !isDesktop ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 rounded-lg text-xs"
          onClick={(e) => {
            e.stopPropagation();
            focus?.setFocusedBlockId(blockId);
            focus?.openMobileSheet({ kind: 'vote', variantId: variant.id });
          }}
        >
          {tCanvas('sheetVote')}
        </Button>
      ) : null}

      {isOpen && isDesktop ? (
        <Button
          type="button"
          size="sm"
          variant={isSelectedInRail ? 'secondary' : 'outline'}
          className="h-7 rounded-lg text-xs"
          onClick={(e) => {
            e.stopPropagation();
            openVoteInRail();
          }}
        >
          {isSelectedInRail ? tCanvas('votingInRail') : tCanvas('voteInRail')}
        </Button>
      ) : null}

      {docMode === 'manual' &&
      variant.status === 'closed-winner' &&
      (variant.rating ?? 0) > 0 &&
      canManageDocument ? (
        <p className="mt-2 text-[10px] text-base-content/45 lg:hidden">{tCanvas('railApplyHint')}</p>
      ) : null}
    </li>
  );
}
