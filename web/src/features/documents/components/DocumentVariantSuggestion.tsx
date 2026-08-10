'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { DocumentCommunityContext } from '@/features/documents/lib/document-canvas-shared';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { DocumentVariantContextPreview } from '@/features/documents/components/DocumentVariantContextPreview';
import { DocumentVariantRevisionView } from '@/features/documents/components/DocumentVariantRevisionView';
import { buildVariantDisplayPreview } from '@/features/documents/lib/document-variant-preview';
import { DocumentVariantReferencesList } from '@/features/documents/components/DocumentVariantReferencesList';
import { DocumentProposalVariantRating } from '@/features/documents/components/DocumentProposalVariantRating';
import { variantStatusToneClass, type DocTranslate } from '@/features/documents/lib/document-canvas-shared';
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
  community: DocumentCommunityContext | null;
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
  onViewVariant?: () => void;
  onDismissProposalsSheet?: () => void;
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
  onViewVariant,
  onDismissProposalsSheet,
  voteBreakdown,
  adminActions,
}: DocumentVariantSuggestionProps) {
  const tGdocs = useTranslations('pages.documents.gdocs');
  const focus = useDocumentCanvasFocus();
  const utils = trpc.useUtils();

  const withdrawMutation = trpc.documentVariants.withdraw.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.documents.getById.invalidate({ id: variant.documentId }),
        utils.documentVariants.listByBlock.invalidate({
          documentId: variant.documentId,
          blockId,
        }),
        utils.documentVariants.listByDocument.invalidate({
          documentId: variant.documentId,
        }),
      ]);
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
    onDismissProposalsSheet?.();
    focus?.setFocusedBlockId(blockId);
    openDocumentVariantVoting({
      variantId: variant.id,
      communityId,
      proposedBy: variant.proposedBy,
      userId,
      docAllowDownvotes,
      community,
      documentContext: { documentId: variant.documentId, blockId },
      returnToProposalsSheet: Boolean(onDismissProposalsSheet),
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

      <div className="my-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-0.5">
        <DocumentProposalVariantRating score={variant.rating ?? 0} />
        <div className="flex flex-wrap justify-end gap-2">
          {onViewVariant ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onViewVariant();
              }}
            >
              {tGdocs('viewProposal')}
            </Button>
          ) : null}
          {isOpen ? (
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg text-xs"
              onClick={openVote}
            >
              {tGdocs('supportProposal')}
            </Button>
          ) : null}
        </div>
      </div>

      {voteBreakdown}

      {adminActions}
    </li>
  );
}
