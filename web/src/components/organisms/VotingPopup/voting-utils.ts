import type { Community } from '@meriter/shared-types';

export function canUseWalletForVoting(
  walletBalance: number,
  community?: Community | null,
): boolean {
  return walletBalance > 0 && community?.votingSettings?.spendsMerits !== false;
}


