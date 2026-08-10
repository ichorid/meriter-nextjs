/** Pure rules: who cannot vote on a publication (Telegram + shared semantics). */

export function resolvePublicationVoteBlockReason(
  authorId: string,
  beneficiaryId: string | undefined | null,
  voterId: string,
): 'author' | 'beneficiary' | null {
  const beneficiary = beneficiaryId?.trim() || undefined;
  const isNomination = Boolean(beneficiary && beneficiary !== authorId);

  if (isNomination) {
    if (voterId === beneficiary) {
      return 'beneficiary';
    }
    return null;
  }

  if (voterId === authorId) {
    return 'author';
  }
  if (beneficiary && voterId === beneficiary) {
    return 'beneficiary';
  }
  return null;
}
