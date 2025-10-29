import { PublicationId, UserId, CommunityId, PublicationContent } from '../../value-objects';

export class Metrics {
  private constructor(
    public readonly upvotes: number,
    public readonly downvotes: number,
    public readonly commentCount: number,
  ) {}

  static zero(): Metrics {
    return new Metrics(0, 0, 0);
  }

  static fromSnapshot(data: { upvotes: number; downvotes: number; commentCount: number }): Metrics {
    return new Metrics(data.upvotes, data.downvotes, data.commentCount);
  }

  applyVote(amount: number): Metrics {
    if (amount > 0) {
      return new Metrics(this.upvotes + amount, this.downvotes, this.commentCount);
    } else {
      return new Metrics(this.upvotes, this.downvotes + Math.abs(amount), this.commentCount);
    }
  }

  incrementComment(): Metrics {
    return new Metrics(this.upvotes, this.downvotes, this.commentCount + 1);
  }

  get score(): number {
    return this.upvotes - this.downvotes;
  }

  toSnapshot() {
    return {
      upvotes: this.upvotes,
      downvotes: this.downvotes,
      commentCount: this.commentCount,
    };
  }
}

export interface PublicationSnapshot {
  id: string;
  communityId: string;
  authorId: string;
  beneficiaryId?: string;
  content: string;
  type: 'text' | 'image' | 'video';
  hashtags: string[];
  metrics: ReturnType<Metrics['toSnapshot']>;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Publication {
  private constructor(
    private readonly id: PublicationId,
    private readonly communityId: CommunityId,
    private readonly authorId: UserId,
    private readonly beneficiaryId: UserId | null,
    private content: PublicationContent,
    private readonly type: 'text' | 'image' | 'video',
    private hashtags: string[],
    private metrics: Metrics,
    private readonly imageUrl: string | null,
    private readonly videoUrl: string | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(
    authorId: UserId,
    communityId: CommunityId,
    content: string,
    type: 'text' | 'image' | 'video',
    options: {
      beneficiaryId?: UserId;
      hashtags?: string[];
      imageUrl?: string;
      videoUrl?: string;
    } = {},
  ): Publication {
    const publicationContent = PublicationContent.create(content);
    
    return new Publication(
      PublicationId.generate(),
      communityId,
      authorId,
      options.beneficiaryId || null,
      publicationContent,
      type,
      options.hashtags || [],
      Metrics.zero(),
      options.imageUrl || null,
      options.videoUrl || null,
      new Date(),
      new Date(),
    );
  }

  static fromSnapshot(snapshot: PublicationSnapshot): Publication {
    return new Publication(
      PublicationId.fromString(snapshot.id),
      CommunityId.fromString(snapshot.communityId),
      UserId.fromString(snapshot.authorId),
      snapshot.beneficiaryId ? UserId.fromString(snapshot.beneficiaryId) : null,
      PublicationContent.create(snapshot.content),
      snapshot.type,
      snapshot.hashtags,
      Metrics.fromSnapshot(snapshot.metrics),
      snapshot.imageUrl || null,
      snapshot.videoUrl || null,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  // Business operations
  vote(amount: number): void {
    this.metrics = this.metrics.applyVote(amount);
    this.updatedAt = new Date();
  }

  addComment(): void {
    this.metrics = this.metrics.incrementComment();
    this.updatedAt = new Date();
  }

  canBeEditedBy(userId: UserId): boolean {
    return this.authorId.equals(userId);
  }

  canBeDeletedBy(userId: UserId): boolean {
    return this.authorId.equals(userId);
  }

  updateContent(content: string): void {
    this.content = PublicationContent.create(content);
    this.updatedAt = new Date();
  }

  updateHashtags(hashtags: string[]): void {
    this.hashtags = [...hashtags];
    this.updatedAt = new Date();
  }

  hasBeneficiary(): boolean {
    return this.beneficiaryId !== null;
  }

  /**
   * Get the effective beneficiary: beneficiaryId if set, otherwise authorId
   */
  getEffectiveBeneficiary(): UserId {
    return this.beneficiaryId || this.authorId;
  }

  // Getters
  get getId(): PublicationId {
    return this.id;
  }

  get getCommunityId(): CommunityId {
    return this.communityId;
  }

  get getAuthorId(): UserId {
    return this.authorId;
  }

  get getBeneficiaryId(): UserId | null {
    return this.beneficiaryId;
  }

  get getContent(): string {
    return this.content.getValue();
  }

  get getType(): 'text' | 'image' | 'video' {
    return this.type;
  }

  get getHashtags(): readonly string[] {
    return this.hashtags;
  }

  get getMetrics(): Metrics {
    return this.metrics;
  }

  get getScore(): number {
    return this.metrics.score;
  }

  // Serialization
  toSnapshot(): PublicationSnapshot {
    return {
      id: this.id.getValue(),
      communityId: this.communityId.getValue(),
      authorId: this.authorId.getValue(),
      beneficiaryId: this.beneficiaryId?.getValue(),
      content: this.content.getValue(),
      type: this.type,
      hashtags: [...this.hashtags],
      metrics: this.metrics.toSnapshot(),
      imageUrl: this.imageUrl || undefined,
      videoUrl: this.videoUrl || undefined,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
