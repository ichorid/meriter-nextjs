'use client';

import { openDocumentVariantVoting } from '@/features/documents/lib/document-variant-voting';
import { buildOfficialBlockVoteTargetId } from '@/features/documents/lib/document-official-vote';
import type { DocumentCommunityContext } from '@/features/documents/lib/document-canvas-shared';

export function openDocumentOfficialVoting(args: {
  documentId: string;
  blockId: string;
  communityId: string;
  userId: string;
  docAllowDownvotes: boolean;
  community: DocumentCommunityContext | null | undefined;
  returnToProposalsSheet?: boolean;
}): void {
  const { documentId, blockId, communityId, userId, docAllowDownvotes, community, returnToProposalsSheet } =
    args;
  openDocumentVariantVoting({
    variantId: buildOfficialBlockVoteTargetId(documentId, blockId),
    communityId,
    proposedBy: '',
    userId,
    docAllowDownvotes,
    community,
    targetType: 'document-block-official',
    documentVariantIsOwn: false,
    documentContext: { documentId, blockId },
    returnToProposalsSheet,
  });
}
