export function canUseWalletForVoting(
  walletBalance: number,
  community?: { votingSettings?: { spendsMerits?: boolean } | null } | null,
): boolean {
  return walletBalance > 0 && community?.votingSettings?.spendsMerits !== false;
}


