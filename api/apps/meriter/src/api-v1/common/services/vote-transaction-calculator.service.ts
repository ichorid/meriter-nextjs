/**
 * Service for calculating vote transaction data
 */
export class VoteTransactionCalculatorService {
  /**
   * Calculate vote transaction data from a vote object
   */
  static calculate(vote: any | null): {
    amountTotal: number;
    plus: number;
    minus: number;
    directionPlus: boolean;
    sum: number;
  } | null {
    if (!vote) {
      return null;
    }

    const voteAmountQuota = vote.amountQuota || 0;
    const voteAmountWallet = vote.amountWallet || 0;
    const voteAmount = voteAmountQuota + voteAmountWallet;
    
    // If quotaAmount > 0, it's an upvote (quota can only be used for upvotes)
    // If quotaAmount === 0, it could be a downvote (downvotes can only use wallet)
    const isUpvote = voteAmountQuota > 0;
    const isDownvote = voteAmountQuota === 0 && voteAmountWallet > 0;

    return {
      amountTotal: voteAmount,
      plus: isUpvote ? voteAmount : 0,
      minus: isDownvote ? voteAmount : 0,
      directionPlus: isUpvote,
      sum: isUpvote ? voteAmount : -voteAmount, // Negative for downvotes
    };
  }
}

