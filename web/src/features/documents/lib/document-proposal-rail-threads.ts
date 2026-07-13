export type DocumentProposalRailThread<T extends { id: string } = { id: string }> = {
  threadId: string;
  blockId: string;
  officialExcerpt: string;
  waveOpen: boolean;
  variants: T[];
};

/**
 * listByDocument can return multiple thread rows for the same block (legacy blockId key
 * vs votingThreadId). The rail shows one voting panel per block, not per thread key.
 */
export function collapseRailThreadsByBlock<T extends { id: string }>(
  threads: DocumentProposalRailThread<T>[],
): DocumentProposalRailThread<T>[] {
  const byBlock = new Map<string, DocumentProposalRailThread<T>>();

  for (const thread of threads) {
    const existing = byBlock.get(thread.blockId);
    if (!existing) {
      byBlock.set(thread.blockId, {
        ...thread,
        variants: [...thread.variants],
      });
      continue;
    }

    const seen = new Set(existing.variants.map((v) => v.id));
    for (const variant of thread.variants) {
      if (!seen.has(variant.id)) {
        existing.variants.push(variant);
        seen.add(variant.id);
      }
    }
    existing.waveOpen = existing.waveOpen || thread.waveOpen;
    if (!existing.officialExcerpt.trim() && thread.officialExcerpt.trim()) {
      existing.officialExcerpt = thread.officialExcerpt;
    }
  }

  return [...byBlock.values()];
}
