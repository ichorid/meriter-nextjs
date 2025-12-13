import { PublicationId, UserId, CommunityId, PublicationContent } from '../../value-objects';
import { BaseMetrics } from '../../common/metrics/base-metrics';
import { EditableEntity } from '../../common/interfaces/editable-entity.interface';
import { AuthorizationHelper } from '../../common/mixins/authorizable-entity.mixin';
import { PublicationSnapshot } from '../../../common/interfaces/publication-document.interface';

export class Metrics extends BaseMetrics {
  private constructor(
    upvotes: number,
    downvotes: number,
    public readonly commentCount: number,
  ) {
    super(upvotes, downvotes);
  }

  static zero(): Metrics {
    return new Metrics(0, 0, 0);
  }

  static fromSnapshot(data: { upvotes: number; downvotes: number; commentCount: number; score?: number }): Metrics {
    return new Metrics(data.upvotes, data.downvotes, data.commentCount);
  }

  protected createNew(upvotes: number, downvotes: number): this {
    return new Metrics(upvotes, downvotes, this.commentCount) as this;
  }

  incrementComment(): Metrics {
    return new Metrics(this.upvotes, this.downvotes, this.commentCount + 1);
  }

  toSnapshot() {
    return {
      upvotes: this.upvotes,
      downvotes: this.downvotes,
      score: this.score,
      commentCount: this.commentCount,
    };
  }
}

export class Publication implements EditableEntity {
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
    private readonly postType: 'basic' | 'poll' | 'project',
    private readonly isProject: boolean,
    private readonly title: string | null,
    private readonly description: string | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) { }

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
      postType?: 'basic' | 'poll' | 'project';
      isProject?: boolean;
      title?: string;
      description?: string;
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
      options.postType || 'basic',
      options.isProject || false,
      options.title || null,
      options.description || null,
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
      snapshot.postType || 'basic',
      snapshot.isProject || false,
      snapshot.title || null,
      snapshot.description || null,
      snapshot.createdAt instanceof Date ? snapshot.createdAt : new Date(snapshot.createdAt),
      snapshot.updatedAt instanceof Date ? snapshot.updatedAt : new Date(snapshot.updatedAt),
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
    return AuthorizationHelper.canBeEditedBy(this.authorId, userId);
  }

  canBeDeletedBy(userId: UserId): boolean {
    return AuthorizationHelper.canBeDeletedBy(this.authorId, userId);
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

  get getPostType(): 'basic' | 'poll' | 'project' {
    return this.postType;
  }

  get getIsProject(): boolean {
    return this.isProject;
  }

  get getTitle(): string | null {
    return this.title;
  }

  get getDescription(): string | null {
    return this.description;
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
      postType: this.postType,
      isProject: this.isProject,
      title: this.title || undefined,
      description: this.description || undefined,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
