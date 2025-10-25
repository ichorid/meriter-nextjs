export class PollOption {
  private constructor(
    public readonly text: string,
    public readonly index: number,
  ) {}

  static create(text: string, index: number): PollOption {
    if (!text || text.trim().length === 0) {
      throw new Error('Poll option text cannot be empty');
    }
    return new PollOption(text.trim(), index);
  }

  equals(other: PollOption): boolean {
    return this.text === other.text && this.index === other.index;
  }

  toSnapshot() {
    return {
      text: this.text,
      index: this.index,
    };
  }
}

export interface PollSnapshot {
  id: string;
  communityId: string;
  authorId: string;
  question: string;
  options: string[];
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Poll {
  private constructor(
    private readonly id: string,
    private readonly communityId: string,
    private readonly authorId: string,
    private readonly question: string,
    private readonly options: PollOption[],
    private readonly expiresAt: Date,
    private isActive: boolean,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(
    authorId: string,
    communityId: string,
    question: string,
    options: string[],
    expiresAt: Date
  ): Poll {
    if (options.length < 2) {
      throw new Error('Poll must have at least 2 options');
    }
    
    const { uid } = require('uid');
    
    const pollOptions = options.map((text, index) => PollOption.create(text, index));
    
    return new Poll(
      uid(),
      communityId,
      authorId,
      question,
      pollOptions,
      expiresAt,
      true,
      new Date(),
      new Date(),
    );
  }

  static fromSnapshot(snapshot: PollSnapshot): Poll {
    const options = snapshot.options.map((text, index) => PollOption.create(text, index));
    
    return new Poll(
      snapshot.id,
      snapshot.communityId,
      snapshot.authorId,
      snapshot.question,
      options,
      snapshot.expiresAt,
      snapshot.isActive,
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

  validateOptionIndex(index: number): boolean {
    return index >= 0 && index < this.options.length;
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

  // Serialization
  toSnapshot(): PollSnapshot {
    return {
      id: this.id,
      communityId: this.communityId,
      authorId: this.authorId,
      question: this.question,
      options: this.options.map(opt => opt.text),
      expiresAt: this.expiresAt,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
