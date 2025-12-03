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
    
    // Use stored direction field instead of inferring from amounts
    const isUpvote = vote.direction === 'up';
    const isDownvote = vote.direction === 'down';

    return {
      amountTotal: voteAmount,
      plus: isUpvote ? voteAmount : 0,
      minus: isDownvote ? voteAmount : 0,
      directionPlus: isUpvote,
      sum: isUpvote ? voteAmount : -voteAmount, // Negative for downvotes
    };
  }
}

