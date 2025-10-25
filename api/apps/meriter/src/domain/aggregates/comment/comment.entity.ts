import { UserId, PublicationId } from '../../value-objects';

export class CommentMetrics {
  private constructor(
    public readonly upthanks: number,
    public readonly downthanks: number,
    public readonly replyCount: number,
  ) {}

  static zero(): CommentMetrics {
    return new CommentMetrics(0, 0, 0);
  }

  static fromSnapshot(data: { upthanks: number; downthanks: number; replyCount: number }): CommentMetrics {
    return new CommentMetrics(data.upthanks, data.downthanks, data.replyCount);
  }

  applyVote(amount: number): CommentMetrics {
    if (amount > 0) {
      return new CommentMetrics(this.upthanks + amount, this.downthanks, this.replyCount);
    } else {
      return new CommentMetrics(this.upthanks, this.downthanks + Math.abs(amount), this.replyCount);
    }
  }

  incrementReply(): CommentMetrics {
    return new CommentMetrics(this.upthanks, this.downthanks, this.replyCount + 1);
  }

  get score(): number {
    return this.upthanks - this.downthanks;
  }

  toSnapshot() {
    return {
      upthanks: this.upthanks,
      downthanks: this.downthanks,
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
  metrics: ReturnType<CommentMetrics['toSnapshot']>;
  parentCommentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Comment {
  private constructor(
    private readonly id: string,
    private readonly targetType: 'publication' | 'comment',
    private readonly targetId: string,
    private readonly authorId: UserId,
    private readonly content: string,
    private metrics: CommentMetrics,
    private readonly parentCommentId: string | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(
    authorId: UserId,
    targetType: 'publication' | 'comment',
    targetId: string,
    content: string,
    parentCommentId?: string
  ): Comment {
    const uuid = require('uuid').v4();
    
    return new Comment(
      uuid,
      targetType,
      targetId,
      authorId,
      content,
      CommentMetrics.zero(),
      parentCommentId || null,
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
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  // Business operations
  vote(amount: number): void {
    this.metrics = this.metrics.applyVote(amount);
    this.updatedAt = new Date();
  }

  addReply(): void {
    this.metrics = this.metrics.incrementReply();
    this.updatedAt = new Date();
  }

  canBeEditedBy(userId: UserId): boolean {
    return this.authorId.equals(userId);
  }

  canBeDeletedBy(userId: UserId): boolean {
    return this.authorId.equals(userId);
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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
