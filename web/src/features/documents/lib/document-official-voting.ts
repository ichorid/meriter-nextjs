'use client';

import { openDocumentVariantVoting } from '@/features/documents/lib/document-variant-voting';
import { buildOfficialBlockVoteTargetId } from '@/features/documents/lib/document-official-vote';
import type { Community } from '@meriter/shared-types';

export function openDocumentOfficialVoting(args: {
  documentId: string;
  blockId: string;
  communityId: string;
  userId: string;
  docAllowDownvotes: boolean;
  community: Community | null | undefined;
}): void {
  const { documentId, blockId, communityId, userId, docAllowDownvotes, community } = args;
  openDocumentVariantVoting({
    variantId: buildOfficialBlockVoteTargetId(documentId, blockId),
    communityId,
    proposedBy: '',
    userId,
    docAllowDownvotes,
    community,
    targetType: 'document-block-official',
    documentVariantIsOwn: false,
  });
}
