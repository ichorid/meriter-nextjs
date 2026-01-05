import { UserId } from '../../value-objects';
import { BaseMetrics } from '../../common/metrics/base-metrics';
import { EditableEntity } from '../../common/interfaces/editable-entity.interface';
import { AuthorizationHelper } from '../../common/mixins/authorizable-entity.mixin';
import { uid } from 'uid';

export class CommentMetrics extends BaseMetrics {
  private constructor(
    upvotes: number,
    downvotes: number,
    public readonly replyCount: number,
  ) {
    super(upvotes, downvotes);
  }

  static zero(): CommentMetrics {
    return new CommentMetrics(0, 0, 0);
  }

  static fromSnapshot(data: { upvotes: number; downvotes: number; replyCount: number; score?: number }): CommentMetrics {
    return new CommentMetrics(data.upvotes, data.downvotes, data.replyCount);
  }

  protected createNew(upvotes: number, downvotes: number): this {
    return new CommentMetrics(upvotes, downvotes, this.replyCount) as this;
  }

  incrementReply(): CommentMetrics {
    return new CommentMetrics(this.upvotes, this.downvotes, this.replyCount + 1);
  }

  toSnapshot() {
    return {
      upvotes: this.upvotes,
      downvotes: this.downvotes,
      replyCount: this.replyCount,
      score: this.score,
    };
  }
}

export interface CommentSnapshot {
  id: string;
  targetType: 'publication' | 'comment';
  targetId: string;
  authorId: string;
  content: string;
  metrics: {
    upvotes: number;
    downvotes: number;
    replyCount: number;
    score?: number; // Optional since it can be calculated
  };
  parentCommentId?: string;
  images?: string[]; // Array of image URLs
  createdAt: Date;
  updatedAt: Date;
}

export class Comment implements EditableEntity {
  private constructor(
    private readonly id: string,
    private readonly targetType: 'publication' | 'comment',
    private readonly targetId: string,
    private readonly authorId: UserId,
    private readonly content: string,
    private metrics: CommentMetrics,
    private readonly parentCommentId: string | null,
    private readonly images: string[],
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(
    authorId: UserId,
    targetType: 'publication' | 'comment',
    targetId: string,
    content: string,
    parentCommentId?: string,
    images?: string[]
  ): Comment {
    
    return new Comment(
      uid(),
      targetType,
      targetId,
      authorId,
      content,
      CommentMetrics.zero(),
      parentCommentId || null,
      images || [],
      new Date(),
      new Date(),
    );
  }

  static fromSnapshot(snapshot: CommentSnapshot): Comment {
    return new Comment(
      snapshot.id,
      snapshot.targetType,
      snapshot.targetId,
      UserId.fromString(snapshot.authorId),
      snapshot.content,
      CommentMetrics.fromSnapshot(snapshot.metrics),
      snapshot.parentCommentId || null,
      snapshot.images || [],
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  // Business operations
  vote(amount: number): void {
    this.metrics = this.metrics.applyVote(amount);
    this.updatedAt = new Date();
  }

  reduceScore(amount: number): void {
    this.metrics = this.metrics.reduceScore(amount);
    this.updatedAt = new Date();
  }

  addReply(): void {
    this.metrics = this.metrics.incrementReply();
    this.updatedAt = new Date();
  }

  canBeEditedBy(userId: UserId): boolean {
    return AuthorizationHelper.canBeEditedBy(this.authorId, userId);
  }

  canBeDeletedBy(userId: UserId): boolean {
    return AuthorizationHelper.canBeDeletedBy(this.authorId, userId);
  }

  /**
   * Get the effective beneficiary: always the author (comments cannot have beneficiaries)
   */
  getEffectiveBeneficiary(): UserId {
    return this.authorId;
  }

  // Getters
  get getId(): string {
    return this.id;
  }

  get getTargetType(): 'publication' | 'comment' {
    return this.targetType;
  }

  get getTargetId(): string {
    return this.targetId;
  }

  get getAuthorId(): UserId {
    return this.authorId;
  }

  get getContent(): string {
    return this.content;
  }

  get getMetrics(): CommentMetrics {
    return this.metrics;
  }

  get getScore(): number {
    return this.metrics.score;
  }

  get getParentCommentId(): string | null {
    return this.parentCommentId;
  }

  get getImages(): string[] {
    return this.images;
  }

  get hasParent(): boolean {
    return this.parentCommentId !== null;
  }

  // Serialization
  toSnapshot(): CommentSnapshot {
    return {
      id: this.id,
      targetType: this.targetType,
      targetId: this.targetId,
      authorId: this.authorId.getValue(),
      content: this.content,
      metrics: this.metrics.toSnapshot(),
      parentCommentId: this.parentCommentId || undefined,
      images: this.images.length > 0 ? this.images : undefined,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
