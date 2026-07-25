import { uid } from 'uid';

export type PollCastDirection = 'up' | 'down';

export interface PollSettings {
  quotaAllowed: boolean;
}

export class PollOption {
  private constructor(
    public readonly id: string,
    public readonly text: string,
    public readonly votes: number,
    public readonly amount: number,
    public readonly casterCount: number,
    public readonly amountUp: number,
    public readonly amountDown: number,
  ) {}

  static create(
    id: string,
    text: string,
    votes: number = 0,
    amount: number = 0,
    casterCount: number = 0,
    amountUp?: number,
    amountDown?: number,
  ): PollOption {
    if (!text || text.trim().length === 0) {
      throw new Error('Poll option text cannot be empty');
    }
    // Legacy options carry only `amount`; treat it as all-up.
    const up = amountUp ?? amount;
    const down = amountDown ?? 0;
    return new PollOption(id, text.trim(), votes, amount, casterCount, up, down);
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
      amountUp: this.amountUp,
      amountDown: this.amountDown,
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

  get getAmountUp(): number {
    return this.amountUp;
  }

  get getAmountDown(): number {
    return this.amountDown;
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
    amountUp?: number;
    amountDown?: number;
    casterCount: number;
  }>;
  expiresAt: Date;
  isActive: boolean;
  metrics: {
    totalCasts: number;
    casterCount: number;
    totalAmount: number;
  };
  settings?: PollSettings;
  resultsAnnouncedAt?: Date;
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
    private readonly settings: PollSettings,
    private resultsAnnouncedAt: Date | undefined,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(
    authorId: string,
    communityId: string,
    question: string,
    description: string | undefined,
    options: Array<{ id?: string; text: string }>,
    expiresAt: Date,
    settings?: Partial<PollSettings>,
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
      { quotaAllowed: settings?.quotaAllowed ?? false },
      undefined,
      new Date(),
      new Date(),
    );
  }

  static fromSnapshot(snapshot: PollSnapshot): Poll {
    const options = snapshot.options.map(opt =>
      PollOption.create(
        opt.id,
        opt.text,
        opt.votes,
        opt.amount,
        opt.casterCount,
        opt.amountUp,
        opt.amountDown,
      )
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
      { quotaAllowed: snapshot.settings?.quotaAllowed ?? false },
      snapshot.resultsAnnouncedAt,
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

  markResultsAnnounced(at: Date = new Date()): void {
    this.resultsAnnouncedAt = at;
    this.updatedAt = new Date();
  }

  addCast(
    optionId: string,
    amount: number,
    isNewCaster: boolean,
    isNewCasterForOption: boolean,
    direction: PollCastDirection = 'up',
  ): void {
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
    const currentAmountUp = typeof option.getAmountUp === 'number' && !isNaN(option.getAmountUp) ? option.getAmountUp : 0;
    const currentAmountDown = typeof option.getAmountDown === 'number' && !isNaN(option.getAmountDown) ? option.getAmountDown : 0;
    const currentCasterCount = typeof option.getCasterCount === 'number' && !isNaN(option.getCasterCount) ? option.getCasterCount : 0;

    const newAmountUp = direction === 'up' ? currentAmountUp + amount : currentAmountUp;
    const newAmountDown = direction === 'down' ? currentAmountDown + amount : currentAmountDown;

    // Option casterCount = unique users who voted for this option (repeat vote by same user does not increase)
    const updatedOption = PollOption.create(
      option.getId,
      option.getText,
      direction === 'up' ? currentVotes + amount : currentVotes,
      newAmountUp - newAmountDown,
      currentCasterCount + (isNewCasterForOption ? 1 : 0),
      newAmountUp,
      newAmountDown,
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

    // Update metrics (totalAmount = total merits spent, both directions)
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

  get getSettings(): PollSettings {
    return this.settings;
  }

  get getResultsAnnouncedAt(): Date | undefined {
    return this.resultsAnnouncedAt;
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
      settings: this.settings,
      resultsAnnouncedAt: this.resultsAnnouncedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
