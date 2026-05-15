import type { Community } from '@meriter/shared-types';
import { useUIStore } from '@/stores/ui.store';

export function openDocumentVariantVoting(args: {
  variantId: string;
  communityId: string;
  proposedBy: string;
  userId: string;
  docAllowDownvotes: boolean;
  community: Community | null | undefined;
}): void {
  const { variantId, communityId, proposedBy, userId, docAllowDownvotes, community } = args;
  const isOwn = proposedBy === userId;
  const mode =
    isOwn || community?.typeTag === 'future-vision'
      ? 'wallet-only'
      : community?.votingSettings?.currencySource === 'quota-only'
        ? 'quota-only'
        : community?.votingSettings?.currencySource === 'wallet-only'
          ? 'wallet-only'
          : 'standard';

  useUIStore.getState().openVotingPopup(variantId, 'document-variant', mode, {
    communityId,
    documentVariantIsOwn: isOwn,
    documentAllowDownvotes: docAllowDownvotes,
  });
}
