export type VoteDirection = 'up' | 'down';

export class VoteAmount {
  private constructor(
    private readonly amount: number,
    private readonly direction: VoteDirection
  ) {}

  static up(amount: number): VoteAmount {
    if (amount <= 0) {
      throw new Error('Upvote amount must be positive');
    }
    return new VoteAmount(amount, 'up');
  }

  static down(amount: number): VoteAmount {
    if (amount <= 0) {
      throw new Error('Downvote amount must be positive');
    }
    return new VoteAmount(amount, 'down');
  }

  getAmount(): number {
    return this.amount;
  }

  getDirection(): VoteDirection {
    return this.direction;
  }

  isUpvote(): boolean {
    return this.direction === 'up';
  }

  isDownvote(): boolean {
    return this.direction === 'down';
  }

  getNumericValue(): number {
    return this.direction === 'up' ? this.amount : -this.amount;
  }
}
