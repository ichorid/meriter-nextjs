export type VariantRowMergeable = {
  id: string;
  content?: string;
  patches?: unknown[];
};

function variantRowScore(v: VariantRowMergeable): number {
  const patchLen = Array.isArray(v.patches) ? v.patches.length : 0;
  return patchLen * 10_000 + (v.content?.length ?? 0);
}

/** Prefer rows with richer patches/content when listByBlock and listByDocument disagree. */
export function mergeDocumentVariantRows<T extends VariantRowMergeable>(
  fromThread: T[] | undefined,
  fromBlock: T[] | undefined,
): T[] {
  const byId = new Map<string, T>();
  for (const row of fromThread ?? []) {
    byId.set(row.id, row);
  }
  for (const row of fromBlock ?? []) {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, row);
      continue;
    }
    const winner = variantRowScore(row) >= variantRowScore(existing) ? row : existing;
    const loser = winner === row ? existing : row;
    byId.set(row.id, {
      ...loser,
      ...winner,
      patches:
        Array.isArray(winner.patches) && winner.patches.length > 0
          ? winner.patches
          : loser.patches,
      content:
        (winner.content?.length ?? 0) >= (loser.content?.length ?? 0)
          ? winner.content
          : loser.content,
    } as T);
  }
  return [...byId.values()];
}
