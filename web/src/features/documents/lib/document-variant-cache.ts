import type { trpc } from '@/lib/trpc/client';
import { filterActiveProposalVariants } from '@/features/documents/lib/document-proposal-utils';
import type { DocSection } from '@/features/documents/lib/document-canvas-shared';

type TrpcUtils = ReturnType<typeof trpc.useUtils>;

type BlockVariantRow = { id: string; status: string };

type DocumentThreadsData = {
  threads: Array<{
    blockId: string;
    officialExcerpt: string;
    waveOpen: boolean;
    variants: BlockVariantRow[];
  }>;
};

export type GovernanceCacheSnapshot = {
  listByBlock?: BlockVariantRow[];
  listByDocument?: DocumentThreadsData;
  document?: { sections?: unknown };
};

/** Refetch document + variant queries so the proposals rail updates without waiting for the 20s poll. */
export async function refetchDocumentProposalCaches(
  utils: TrpcUtils,
  documentId: string,
  blockId: string,
): Promise<void> {
  await refetchDocumentGovernanceCaches(utils, documentId, blockId);
}

export async function refetchDocumentGovernanceCaches(
  utils: TrpcUtils,
  documentId: string,
  blockId: string,
): Promise<void> {
  await Promise.all([
    utils.documents.getById.refetch({ id: documentId }),
    utils.documentVariants.listByDocument.refetch({ documentId }),
    utils.documentVariants.listByBlock.refetch({ documentId, blockId }),
    utils.documentVariants.getBlockVotingPanel.refetch({ documentId, blockId }),
    utils.documentVariants.getBlockGovernanceHistory.refetch({ documentId, blockId }),
  ]);
}

function patchDocumentBlockWaveClosed<T extends { sections?: unknown }>(
  doc: T,
  blockId: string,
): T {
  if (!Array.isArray(doc.sections)) {
    return doc;
  }
  const sections = (doc.sections as DocSection[]).map((section) => ({
    ...section,
    blocks: section.blocks?.map((block) =>
      block.id === blockId ? { ...block, currentWaveStartedAt: null } : block,
    ),
  }));
  return { ...doc, sections };
}

/** Instant UI after variant delete/withdraw — avoids waiting for DOCUMENT_LIVE_POLL_INTERVAL_MS. */
export function optimisticallyRemoveVariantFromCaches(
  utils: TrpcUtils,
  documentId: string,
  blockId: string,
  variantId: string,
): GovernanceCacheSnapshot {
  const snapshot: GovernanceCacheSnapshot = {};
  const blockKey = { documentId, blockId };

  const prevBlock = utils.documentVariants.listByBlock.getData(blockKey);
  if (prevBlock) {
    snapshot.listByBlock = prevBlock;
    const nextBlock = prevBlock.filter((v) => v.id !== variantId);
    utils.documentVariants.listByBlock.setData(blockKey, nextBlock);

    if (filterActiveProposalVariants(nextBlock).length === 0) {
      const prevDoc = utils.documents.getById.getData({ id: documentId });
      if (prevDoc) {
        snapshot.document = prevDoc as { sections?: unknown };
        utils.documents.getById.setData(
          { id: documentId },
          patchDocumentBlockWaveClosed(prevDoc, blockId),
        );
      }
    }
  }

  const prevThreads = utils.documentVariants.listByDocument.getData({ documentId });
  if (prevThreads) {
    snapshot.listByDocument = prevThreads;
    const threads = prevThreads.threads
      .map((thread) => {
        const variants = thread.variants.filter((v) => v.id !== variantId);
        const hasOpen = variants.some((v) => v.status === 'open');
        return {
          ...thread,
          variants,
          waveOpen: hasOpen ? thread.waveOpen : false,
        };
      })
      .filter((thread) => thread.variants.length > 0);
    utils.documentVariants.listByDocument.setData({ documentId }, { threads });
  }

  return snapshot;
}

export function restoreGovernanceCacheSnapshot(
  utils: TrpcUtils,
  documentId: string,
  blockId: string,
  snapshot: GovernanceCacheSnapshot | undefined,
): void {
  if (!snapshot) {
    return;
  }
  if (snapshot.listByBlock) {
    utils.documentVariants.listByBlock.setData(
      { documentId, blockId },
      snapshot.listByBlock,
    );
  }
  if (snapshot.listByDocument) {
    utils.documentVariants.listByDocument.setData({ documentId }, snapshot.listByDocument);
  }
  if (snapshot.document) {
    utils.documents.getById.setData({ id: documentId }, snapshot.document);
  }
}
