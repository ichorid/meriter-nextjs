import type { Community } from '@meriter/shared-types';
import { useUIStore } from '@/stores/ui.store';

export function openDocumentVariantVoting(args: {
  variantId: string;
  communityId: string;
  proposedBy: string;
  userId: string;
  docAllowDownvotes: boolean;
  community: Community | null | undefined;
  targetType?: 'document-variant' | 'document-block-official';
  documentVariantIsOwn?: boolean;
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
  });
}
