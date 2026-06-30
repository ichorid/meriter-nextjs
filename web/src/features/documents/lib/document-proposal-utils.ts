export type DocumentVariantStatus =
  | 'open'
  | 'closed-winner'
  | 'closed-not-winner'
  | 'applied'
  | 'withdrawn';

export interface DocumentVariantLike {
  status: DocumentVariantStatus | string;
}

/** Variants still visible in the proposals panel (voting or awaiting manual apply). */
export function filterActiveProposalVariants<T extends DocumentVariantLike>(variants: T[]): T[] {
  return variants.filter((v) => v.status === 'open' || v.status === 'closed-winner');
}

export function countActiveProposalVariants(variants: DocumentVariantLike[]): number {
  return filterActiveProposalVariants(variants).length;
}

/** True when block has past votes / applies worth showing in history. */
export function blockHasGovernanceHistory(
  variants: DocumentVariantLike[],
  editHistoryLength: number,
): boolean {
  return (
    editHistoryLength > 0 ||
    variants.some((v) =>
      ['applied', 'closed-not-winner', 'withdrawn', 'closed-winner'].includes(v.status),
    )
  );
}

/** Manual apply of the official text is pending (official won the wave). */
export function isPendingOfficialManualPick(
  docMode: 'manual' | 'auto',
  waveActive: boolean,
  variants: DocumentVariantLike[],
): boolean {
  if (docMode !== 'manual' || waveActive) {
    return false;
  }
  if (variants.some((v) => v.status === 'open' || v.status === 'closed-winner' || v.status === 'applied')) {
    return false;
  }
  return variants.some((v) => v.status === 'closed-not-winner');
}
