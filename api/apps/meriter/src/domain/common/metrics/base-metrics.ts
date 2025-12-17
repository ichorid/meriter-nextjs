/**
 * Base abstract class for entity metrics
 * Provides shared logic for vote tracking and score calculation
 */
export abstract class BaseMetrics {
  protected constructor(
    public readonly upvotes: number,
    public readonly downvotes: number,
  ) {}

  /**
   * Apply a vote amount to metrics
   * Positive amounts increase upvotes, negative amounts increase downvotes
   */
  applyVote(amount: number): this {
    if (amount > 0) {
      return this.createNew(this.upvotes + amount, this.downvotes);
    } else {
      return this.createNew(this.upvotes, this.downvotes + Math.abs(amount));
    }
  }

  /**
   * Reduce score by withdrawing merits
   * Reduces upvotes by the specified amount (cannot reduce below 0)
   */
  reduceScore(amount: number): this {
    if (amount <= 0) {
      return this;
    }
    const newUpvotes = Math.max(0, this.upvotes - amount);
    return this.createNew(newUpvotes, this.downvotes);
  }

  /**
   * Calculate score as difference between upvotes and downvotes
   */
  get score(): number {
    return this.upvotes - this.downvotes;
  }

  /**
   * Create a new instance of the metrics class with updated values
   * Must be implemented by subclasses to return the correct type
   */
  protected abstract createNew(upvotes: number, downvotes: number): this;

  /**
   * Convert metrics to snapshot format
   * Subclasses should override to include their specific fields
   */
  abstract toSnapshot(): {
    upvotes: number;
    downvotes: number;
    score?: number; // Optional since it can be calculated
  };
}

