import { uid } from 'uid';

export class PollOption {
  private constructor(
    public readonly id: string,
    public readonly text: string,
    public readonly votes: number,
    public readonly amount: number,
    public readonly casterCount: number,
  ) {}

  static create(id: string, text: string, votes: number = 0, amount: number = 0, casterCount: number = 0): PollOption {
    if (!text || text.trim().length === 0) {
      throw new Error('Poll option text cannot be empty');
    }
    return new PollOption(id, text.trim(), votes, amount, casterCount);
  }

  equals(other: PollOption): boolean {
    return this.id === other.id;
  }

  toSnapshot() {
    return {
      id: this.id,
      text: this.text,
      votes: this.votes,
      amount: this.amount,
      casterCount: this.casterCount,
    };
  }

  // Getters
  get getId(): string {
    return this.id;
  }

  get getText(): string {
    return this.text;
  }

  get getVotes(): number {
    return this.votes;
  }

  get getAmount(): number {
    return this.amount;
  }

  get getCasterCount(): number {
    return this.casterCount;
  }
}

export interface PollSnapshot {
  id: string;
  communityId: string;
  authorId: string;
  question: string;
  description?: string;
  options: Array<{
    id: string;
    text: string;
    votes: number;
    amount: number;
    casterCount: number;
  }>;
  expiresAt: Date;
  isActive: boolean;
  metrics: {
    totalCasts: number;
    casterCount: number;
    totalAmount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class Poll {
  private constructor(
    private readonly id: string,
    private readonly communityId: string,
    private readonly authorId: string,
    private readonly question: string,
    private readonly description: string | undefined,
    private options: PollOption[],
    private readonly expiresAt: Date,
    private isActive: boolean,
    private metrics: { totalCasts: number; casterCount: number; totalAmount: number },
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(
    authorId: string,
    communityId: string,
    question: string,
    description: string | undefined,
    options: Array<{ id?: string; text: string }>,
    expiresAt: Date
  ): Poll {
    if (options.length < 2) {
      throw new Error('Poll must have at least 2 options');
    }
    
    
    // Generate IDs for options that don't have them
    const pollOptions = options.map(opt => 
      PollOption.create(opt.id || uid(), opt.text, 0, 0, 0)
    );
    
    return new Poll(
      uid(),
      communityId,
      authorId,
      question,
      description,
      pollOptions,
      expiresAt,
      true,
      { totalCasts: 0, casterCount: 0, totalAmount: 0 },
      new Date(),
      new Date(),
    );
  }

  static fromSnapshot(snapshot: PollSnapshot): Poll {
    const options = snapshot.options.map(opt => 
      PollOption.create(opt.id, opt.text, opt.votes, opt.amount, opt.casterCount)
    );
    
    // Ensure metrics are properly initialized with defaults if missing or invalid
    const metrics = snapshot.metrics || { totalCasts: 0, casterCount: 0, totalAmount: 0 };
    const safeMetrics = {
      totalCasts: typeof metrics.totalCasts === 'number' && !isNaN(metrics.totalCasts) ? metrics.totalCasts : 0,
      casterCount: typeof metrics.casterCount === 'number' && !isNaN(metrics.casterCount) ? metrics.casterCount : 0,
      totalAmount: typeof metrics.totalAmount === 'number' && !isNaN(metrics.totalAmount) ? metrics.totalAmount : 0,
    };
    
    return new Poll(
      snapshot.id,
      snapshot.communityId,
      snapshot.authorId,
      snapshot.question,
      snapshot.description,
      options,
      snapshot.expiresAt,
      snapshot.isActive,
      safeMetrics,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  // Business operations
  hasExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isCurrentlyActive(): boolean {
    return this.isActive && !this.hasExpired();
  }

  canVoteOn(): boolean {
    return this.isCurrentlyActive();
  }

  validateOptionId(optionId: string): boolean {
    return this.options.some(opt => opt.getId === optionId);
  }

  getOption(optionId: string): PollOption | undefined {
    return this.options.find(opt => opt.getId === optionId);
  }

  expire(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  addCast(optionId: string, amount: number, isNewCaster: boolean): void {
    if (!this.isCurrentlyActive()) {
      throw new Error('Cannot cast on inactive or expired poll');
    }

    const optionIndex = this.options.findIndex(opt => opt.getId === optionId);
    if (optionIndex === -1) {
      throw new Error(`Option ${optionId} not found`);
    }

    const option = this.options[optionIndex];
    
    // Ensure option values are numbers
    const currentVotes = typeof option.getVotes === 'number' && !isNaN(option.getVotes) ? option.getVotes : 0;
    const currentAmount = typeof option.getAmount === 'number' && !isNaN(option.getAmount) ? option.getAmount : 0;
    const currentCasterCount = typeof option.getCasterCount === 'number' && !isNaN(option.getCasterCount) ? option.getCasterCount : 0;
    
    // Create new option with updated values
    const updatedOption = PollOption.create(
      option.getId,
      option.getText,
      currentVotes + amount,
      currentAmount + amount,
      currentCasterCount + (isNewCaster ? 1 : 0)
    );

    // Replace option in array
    this.options[optionIndex] = updatedOption;

    // Ensure metrics are initialized and are numbers
    if (!this.metrics) {
      this.metrics = { totalCasts: 0, casterCount: 0, totalAmount: 0 };
    }
    const currentTotalCasts = typeof this.metrics.totalCasts === 'number' && !isNaN(this.metrics.totalCasts) ? this.metrics.totalCasts : 0;
    const currentTotalAmount = typeof this.metrics.totalAmount === 'number' && !isNaN(this.metrics.totalAmount) ? this.metrics.totalAmount : 0;
    const currentCasterCountMetric = typeof this.metrics.casterCount === 'number' && !isNaN(this.metrics.casterCount) ? this.metrics.casterCount : 0;

    // Update metrics
    this.metrics.totalCasts = currentTotalCasts + 1;
    this.metrics.totalAmount = currentTotalAmount + amount;
    if (isNewCaster) {
      this.metrics.casterCount = currentCasterCountMetric + 1;
    }

    // Update timestamp
    this.updatedAt = new Date();
  }

  // Getters
  get getId(): string {
    return this.id;
  }

  get getCommunityId(): string {
    return this.communityId;
  }

  get getAuthorId(): string {
    return this.authorId;
  }

  get getQuestion(): string {
    return this.question;
  }

  get getOptions(): readonly PollOption[] {
    return this.options;
  }

  get getExpiresAt(): Date {
    return this.expiresAt;
  }

  get getIsActive(): boolean {
    return this.isActive;
  }

  get getDescription(): string | undefined {
    return this.description;
  }

  get getMetrics() {
    return this.metrics;
  }

  // Serialization
  toSnapshot(): PollSnapshot {
    return {
      id: this.id,
      communityId: this.communityId,
      authorId: this.authorId,
      question: this.question,
      description: this.description,
      options: this.options.map(opt => opt.toSnapshot()),
      expiresAt: this.expiresAt,
      isActive: this.isActive,
      metrics: this.metrics,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
