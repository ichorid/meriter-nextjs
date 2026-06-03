'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Community } from '@meriter/shared-types';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { DocumentVariantContextPreview } from '@/features/documents/components/DocumentVariantContextPreview';
import { DocumentVariantRevisionView } from '@/features/documents/components/DocumentVariantRevisionView';
import { buildVariantDisplayPreview } from '@/features/documents/lib/document-variant-preview';
import { DocumentVariantReferencesList } from '@/features/documents/components/DocumentVariantReferencesList';
import { variantStatusLabelKey, variantStatusToneClass, type DocTranslate } from '@/features/documents/lib/document-canvas-shared';
import { openDocumentVariantVoting } from '@/features/documents/lib/document-variant-voting';
import type { DocumentVariantReference } from '@/features/documents/types/document-variant-reference';
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
  userId: string;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  t: DocTranslate;
  officialHtml?: string;
  blockType?: string;
  prevBlockHtml?: string;
  nextBlockHtml?: string;
  rangeStart?: number;
  rangeEnd?: number;
  proposedText?: string;
  className?: string;
  voteBreakdown?: React.ReactNode;
  adminActions?: React.ReactNode;
}

export function DocumentVariantSuggestion({
  variant,
  blockId,
  docMode,
  docAllowDownvotes,
  canManageDocument,
  community,
  userId,
  addToast,
  t,
  officialHtml = '',
  blockType,
  prevBlockHtml,
  nextBlockHtml,
  rangeStart,
  rangeEnd,
  proposedText,
  className,
  voteBreakdown,
  adminActions,
}: DocumentVariantSuggestionProps) {
  const tCanvas = useTranslations('pages.documents.canvas');
  const focus = useDocumentCanvasFocus();
  const utils = trpc.useUtils();

  const withdrawMutation = trpc.documentVariants.withdraw.useMutation({
    onSuccess: async () => {
      await utils.documents.getById.invalidate({ id: variant.documentId });
      await utils.documentVariants.listByBlock.invalidate({
        documentId: variant.documentId,
        blockId,
      });
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const isOpen = variant.status === 'open';
  const isOwnOpen = isOpen && variant.proposedBy === userId;
  const communityId = community?.id ?? focus?.community?.id ?? '';

  const contextPreview = useMemo(
    () =>
      buildVariantDisplayPreview(
        officialHtml,
        {
          content: variant.content,
          rangeStart,
          rangeEnd,
          proposedText,
        },
        { prevBlockHtml, nextBlockHtml },
      ),
    [
      officialHtml,
      variant.content,
      rangeStart,
      rangeEnd,
      proposedText,
      prevBlockHtml,
      nextBlockHtml,
    ],
  );

  const openVote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!communityId) return;
    focus?.setFocusedBlockId(blockId);
    openDocumentVariantVoting({
      variantId: variant.id,
      communityId,
      proposedBy: variant.proposedBy,
      userId,
      docAllowDownvotes,
      community,
    });
  };

  return (
    <li
      className={cn(
        'rounded-xl border border-base-300/40 bg-base-200/50 p-3',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
            variantStatusToneClass(variant.status),
          )}
          aria-hidden
        />
        <span className="font-medium text-base-content/80">
          {t(variantStatusLabelKey(variant.status))}
        </span>
        <span className="text-base-content/45">·</span>
        <span className="text-base-content/55">{t('rating', { rating: variant.rating ?? 0 })}</span>
        {isOwnOpen ? (
          <button
            type="button"
            className="ml-auto text-[11px] text-base-content/50 underline-offset-2 hover:text-error hover:underline disabled:opacity-50"
            disabled={withdrawMutation.isPending}
            onClick={(e) => {
              e.stopPropagation();
              withdrawMutation.mutate({ variantId: variant.id });
            }}
          >
            {t('withdraw')}
          </button>
        ) : null}
      </div>

      {contextPreview ? (
        <DocumentVariantContextPreview
          preview={contextPreview}
          blockType={blockType}
          className="text-base-content/90"
        />
      ) : null}

      <DocumentVariantRevisionView
        officialHtml={officialHtml}
        variantHtml={variant.content}
        blockType={blockType}
        contentClassName="text-sm leading-relaxed text-base-content/90"
        suppressDefaultPreview={contextPreview != null}
      />

      {variant.references.length > 0 ? (
        <DocumentVariantReferencesList
          references={variant.references}
          className="mt-2 text-xs text-base-content/55"
        />
      ) : null}

      {isOpen ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 h-8 rounded-lg text-xs"
          onClick={openVote}
        >
          {tCanvas('sheetVote')}
        </Button>
      ) : null}

      {voteBreakdown}

      {adminActions}
    </li>
  );
}
