import type { Investment } from '@meriter/shared-types';

/** Shape stored on publication aggregate / snapshot before feed serialization. */
export type RawPublicationInvestment = {
  investorId: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
  totalEarnings?: number;
  earningsHistory?: Investment['earningsHistory'];
};

export function mapInvestmentsForPublicationFeed(
  raw: readonly RawPublicationInvestment[] | undefined,
): Investment[] {
  return (raw ?? []).map((inv) => ({
    investorId: inv.investorId,
    amount: inv.amount,
    createdAt:
      inv.createdAt instanceof Date
        ? inv.createdAt.toISOString()
        : String(inv.createdAt),
    updatedAt:
      inv.updatedAt instanceof Date
        ? inv.updatedAt.toISOString()
        : String(inv.updatedAt),
    totalEarnings: inv.totalEarnings ?? 0,
    earningsHistory: inv.earningsHistory ?? [],
  }));
}
