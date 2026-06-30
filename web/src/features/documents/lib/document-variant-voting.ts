import { useUIStore } from '@/stores/ui.store';
import type { DocumentCommunityContext } from '@/features/documents/lib/document-canvas-shared';

export function openDocumentVariantVoting(args: {
  variantId: string;
  communityId: string;
  proposedBy: string;
  userId: string;
  docAllowDownvotes: boolean;
  community: DocumentCommunityContext | null | undefined;
  targetType?: 'document-variant' | 'document-block-official';
  documentVariantIsOwn?: boolean;
  /** Scope for targeted cache invalidation after the vote */
  documentContext?: { documentId: string; blockId?: string };
  /** After vote popup closes, reopen mobile proposals sheet if it was dismissed */
  returnToProposalsSheet?: boolean;
}): void {
  const {
    variantId,
    communityId,
    proposedBy,
    userId,
    docAllowDownvotes,
    community,
    targetType = 'document-variant',
    documentVariantIsOwn,
    documentContext,
    returnToProposalsSheet,
  } = args;
  const isOwn = documentVariantIsOwn ?? (targetType === 'document-variant' && proposedBy === userId);
  const mode =
    isOwn || community?.typeTag === 'future-vision'
      ? 'wallet-only'
      : community?.votingSettings?.currencySource === 'quota-only'
        ? 'quota-only'
        : community?.votingSettings?.currencySource === 'wallet-only'
          ? 'wallet-only'
          : 'standard';

  useUIStore.getState().openVotingPopup(variantId, targetType, mode, {
    communityId,
    documentVariantIsOwn: isOwn,
    documentAllowDownvotes: docAllowDownvotes,
    documentContext,
    returnToDocumentProposalsSheet: returnToProposalsSheet === true,
  });
}
