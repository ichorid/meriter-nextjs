export class PollOption {
  private constructor(
    public readonly id: string,
    public readonly text: string,
    public readonly votes: number,
    public readonly amount: number,
    public readonly voterCount: number,
  ) {}

  static create(id: string, text: string, votes: number = 0, amount: number = 0, voterCount: number = 0): PollOption {
    if (!text || text.trim().length === 0) {
      throw new Error('Poll option text cannot be empty');
    }
    return new PollOption(id, text.trim(), votes, amount, voterCount);
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
      voterCount: this.voterCount,
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

  get getVoterCount(): number {
    return this.voterCount;
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
    voterCount: number;
  }>;
  expiresAt: Date;
  isActive: boolean;
  metrics: {
    totalVotes: number;
    voterCount: number;
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
    private readonly options: PollOption[],
    private readonly expiresAt: Date,
    private isActive: boolean,
    private readonly metrics: { totalVotes: number; voterCount: number; totalAmount: number },
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(
    authorId: string,
    communityId: string,
    question: string,
    description: string | undefined,
    options: Array<{ id: string; text: string }>,
    expiresAt: Date
  ): Poll {
    if (options.length < 2) {
      throw new Error('Poll must have at least 2 options');
    }
    
    const { uid } = require('uid');
    
    const pollOptions = options.map(opt => PollOption.create(opt.id, opt.text, 0, 0, 0));
    
    return new Poll(
      uid(),
      communityId,
      authorId,
      question,
      description,
      pollOptions,
      expiresAt,
      true,
      { totalVotes: 0, voterCount: 0, totalAmount: 0 },
      new Date(),
      new Date(),
    );
  }

  static fromSnapshot(snapshot: PollSnapshot): Poll {
    const options = snapshot.options.map(opt => 
      PollOption.create(opt.id, opt.text, opt.votes, opt.amount, opt.voterCount)
    );
    
    return new Poll(
      snapshot.id,
      snapshot.communityId,
      snapshot.authorId,
      snapshot.question,
      snapshot.description,
      options,
      snapshot.expiresAt,
      snapshot.isActive,
      snapshot.metrics,
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
