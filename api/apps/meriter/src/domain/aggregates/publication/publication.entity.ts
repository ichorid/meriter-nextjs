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
    // If score is provided and differs from calculated score, adjust upvotes to preserve the stored score
    // This is necessary because tappalka updates score directly without updating upvotes/downvotes
    let adjustedUpvotes = data.upvotes;
    if (data.score !== undefined) {
      const calculatedScore = data.upvotes - data.downvotes;
      const scoreDifference = data.score - calculatedScore;
      // Adjust upvotes to match the stored score (tappalka bonuses are added to score)
      // Only adjust if difference is significant (to handle floating point precision)
      if (Math.abs(scoreDifference) > 0.0001) {
        adjustedUpvotes = Math.max(0, data.upvotes + scoreDifference); // Ensure upvotes doesn't go negative
      }
    }
    return new Metrics(adjustedUpvotes, data.downvotes, data.commentCount);
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
    private categories: string[],
    private metrics: Metrics,
    private readonly imageUrl: string | null,
    private readonly images: string[],
    private readonly videoUrl: string | null,
    private readonly postType: 'basic' | 'poll' | 'project',
    private readonly isProject: boolean,
    private readonly title: string | null,
    private readonly description: string | null,
    private readonly impactArea: string | null,
    private readonly beneficiaries: string[],
    private readonly methods: string[],
    private readonly stage: string | null,
    private readonly helpNeeded: string[],
    private readonly deleted: boolean,
    private readonly deletedAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
    private readonly investingEnabled?: boolean,
    private readonly investorSharePercent?: number,
    private readonly investmentPool?: number,
    private readonly investmentPoolTotal?: number,
    private readonly investments?: Array<{ investorId: string; amount: number; createdAt: Date; updatedAt: Date }>,
    private readonly ttlDays?: 7 | 14 | 30 | 60 | 90 | null,
    private readonly ttlExpiresAt?: Date | null,
    private readonly stopLoss?: number,
    private readonly noAuthorWalletSpend?: boolean,
    private readonly status?: 'active' | 'closed',
    private readonly closedAt?: Date | null,
    private readonly closeReason?: 'manual' | 'ttl' | 'inactive' | 'negative_rating' | null,
    private readonly closingSummary?: PublicationSnapshot['closingSummary'],
    private readonly lastEarnedAt?: Date | null,
    private readonly ttlWarningNotified?: boolean,
    private readonly inactivityWarningNotified?: boolean,
  ) {}

  static create(
    authorId: UserId,
    communityId: CommunityId,
    content: string,
    type: 'text' | 'image' | 'video',
    options: {
      beneficiaryId?: UserId;
      hashtags?: string[];
      categories?: string[];
      imageUrl?: string;
      images?: string[];
      videoUrl?: string;
      postType?: 'basic' | 'poll' | 'project';
      isProject?: boolean;
      title?: string;
      description?: string;
      impactArea?: string;
      beneficiaries?: string[];
      methods?: string[];
      stage?: string;
      helpNeeded?: string[];
      ttlDays?: 7 | 14 | 30 | 60 | 90 | null;
      ttlExpiresAt?: Date | null;
      stopLoss?: number;
      noAuthorWalletSpend?: boolean;
    } = {},
  ): Publication {
    const publicationContent = PublicationContent.create(content);
    // Support both legacy imageUrl and new images array
    const images = options.images || (options.imageUrl ? [options.imageUrl] : []);

    return new Publication(
      PublicationId.generate(),
      communityId,
      authorId,
      options.beneficiaryId || null,
      publicationContent,
      type,
      options.hashtags || [],
      options.categories || [],
      Metrics.zero(),
      options.imageUrl || null,
      images,
      options.videoUrl || null,
      options.postType || 'basic',
      options.isProject || false,
      options.title || null,
      options.description || null,
      options.impactArea || null,
      options.beneficiaries || [],
      options.methods || [],
      options.stage || null,
      options.helpNeeded || [],
      false, // deleted
      null, // deletedAt
      new Date(),
      new Date(),
      undefined, // investingEnabled (set by service on persist)
      undefined, // investorSharePercent
      undefined, // investmentPool
      undefined, // investmentPoolTotal
      undefined, // investments
      options.ttlDays ?? null,
      options.ttlExpiresAt ?? null,
      options.stopLoss ?? 0,
      options.noAuthorWalletSpend ?? false,
      'active', // status
      null, // closedAt
      null, // closeReason
      undefined, // closingSummary
      undefined, // lastEarnedAt
      false, // ttlWarningNotified
      false, // inactivityWarningNotified
    );
  }

  static fromSnapshot(snapshot: PublicationSnapshot): Publication {
    // Support both legacy imageUrl and new images array
    const images = snapshot.images || (snapshot.imageUrl ? [snapshot.imageUrl] : []);

    return new Publication(
      PublicationId.fromString(snapshot.id),
      CommunityId.fromString(snapshot.communityId),
      UserId.fromString(snapshot.authorId),
      snapshot.beneficiaryId ? UserId.fromString(snapshot.beneficiaryId) : null,
      PublicationContent.create(snapshot.content),
      snapshot.type,
      snapshot.hashtags || [],
      snapshot.categories || [],
      Metrics.fromSnapshot(snapshot.metrics),
      snapshot.imageUrl || null,
      images,
      snapshot.videoUrl || null,
      snapshot.postType || 'basic',
      snapshot.isProject || false,
      snapshot.title || null,
      snapshot.description || null,
      snapshot.impactArea || null,
      snapshot.beneficiaries || [],
      snapshot.methods || [],
      snapshot.stage || null,
      snapshot.helpNeeded || [],
      snapshot.deleted || false,
      snapshot.deletedAt ? (snapshot.deletedAt instanceof Date ? snapshot.deletedAt : new Date(snapshot.deletedAt)) : null,
      snapshot.createdAt instanceof Date ? snapshot.createdAt : new Date(snapshot.createdAt),
      snapshot.updatedAt instanceof Date ? snapshot.updatedAt : new Date(snapshot.updatedAt),
      snapshot.investingEnabled,
      snapshot.investorSharePercent,
      snapshot.investmentPool,
      snapshot.investmentPoolTotal,
      snapshot.investments,
      snapshot.ttlDays ?? null,
      snapshot.ttlExpiresAt != null ? (snapshot.ttlExpiresAt instanceof Date ? snapshot.ttlExpiresAt : new Date(snapshot.ttlExpiresAt)) : null,
      snapshot.stopLoss ?? 0,
      snapshot.noAuthorWalletSpend ?? false,
      snapshot.status ?? 'active',
      snapshot.closedAt != null ? (snapshot.closedAt instanceof Date ? snapshot.closedAt : new Date(snapshot.closedAt)) : null,
      snapshot.closeReason ?? null,
      snapshot.closingSummary ?? undefined,
      snapshot.lastEarnedAt != null ? (snapshot.lastEarnedAt instanceof Date ? snapshot.lastEarnedAt : new Date(snapshot.lastEarnedAt)) : null,
      snapshot.ttlWarningNotified ?? false,
      snapshot.inactivityWarningNotified ?? false,
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

  updateCategories(categories: string[]): void {
    this.categories = [...categories];
    this.updatedAt = new Date();
  }

  hasBeneficiary(): boolean {
    return this.beneficiaryId !== null;
  }

  /**
   * Get the effective beneficiary: beneficiaryId if set, otherwise authorId
   */
  getEffectiveBeneficiary(): UserId {
    return this.beneficiaryId ?? this.authorId;
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

  get getCategories(): readonly string[] {
    return this.categories;
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

  get getImageUrl(): string | null {
    return this.imageUrl;
  }

  get getImages(): string[] {
    return this.images;
  }

  get getImpactArea(): string | null {
    return this.impactArea;
  }

  get getBeneficiaries(): readonly string[] {
    return this.beneficiaries;
  }

  get getMethods(): readonly string[] {
    return this.methods;
  }

  get getStage(): string | null {
    return this.stage;
  }

  get getHelpNeeded(): readonly string[] {
    return this.helpNeeded;
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
      categories: this.categories.length > 0 ? [...this.categories] : undefined,
      metrics: this.metrics.toSnapshot(),
      imageUrl: this.imageUrl || undefined,
      images: this.images.length > 0 ? this.images : undefined,
      videoUrl: this.videoUrl || undefined,
      postType: this.postType,
      isProject: this.isProject,
      title: this.title || undefined,
      description: this.description || undefined,
      impactArea: this.impactArea || undefined,
      beneficiaries: this.beneficiaries.length > 0 ? [...this.beneficiaries] : undefined,
      methods: this.methods.length > 0 ? [...this.methods] : undefined,
      stage: this.stage || undefined,
      helpNeeded: this.helpNeeded.length > 0 ? [...this.helpNeeded] : undefined,
      deleted: this.deleted || undefined,
      deletedAt: this.deletedAt || undefined,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      investingEnabled: this.investingEnabled,
      investorSharePercent: this.investorSharePercent,
      investmentPool: this.investmentPool,
      investmentPoolTotal: this.investmentPoolTotal,
      investments: this.investments,
      ttlDays: this.ttlDays ?? undefined,
      ttlExpiresAt: this.ttlExpiresAt ?? undefined,
      stopLoss: this.stopLoss ?? 0,
      noAuthorWalletSpend: this.noAuthorWalletSpend ?? false,
      status: this.status ?? 'active',
      closedAt: this.closedAt ?? undefined,
      closeReason: this.closeReason ?? undefined,
      closingSummary: this.closingSummary ?? undefined,
      lastEarnedAt: this.lastEarnedAt ?? undefined,
      ttlWarningNotified: this.ttlWarningNotified ?? false,
      inactivityWarningNotified: this.inactivityWarningNotified ?? false,
    };
  }
}
