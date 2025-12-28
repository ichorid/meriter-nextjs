import { Publication } from '../../../domain/aggregates/publication/publication.entity';
import { UserFormatter } from '../utils/user-formatter.util';

/**
 * Utility class for mapping domain entities to API response formats
 */
export class EntityMappers {
  /**
   * Format community for API response (origin format)
   */
  private static formatCommunityForApi(community: any | null):
    | {
        telegramChatName?: string;
      }
    | undefined {
    if (!community) {
      return undefined;
    }

    return {
      telegramChatName: community.name,
    };
  }

  /**
   * Map Publication entity to API format
   */
  static mapPublicationToApi(
    publication: Publication,
    usersMap: Map<string, any>,
    communitiesMap: Map<string, any>,
  ): any {
    const authorId = publication.getAuthorId.getValue();
    const beneficiaryId = publication.getBeneficiaryId?.getValue();
    const communityId = publication.getCommunityId.getValue();
    const author = usersMap.get(authorId);
    const beneficiary = beneficiaryId ? usersMap.get(beneficiaryId) : null;
    const community = communitiesMap.get(communityId);
    const snapshot = publication.toSnapshot();

    return {
      id: publication.getId.getValue(),
      _id: publication.getId.getValue(), // For compatibility with Publication component
      slug: publication.getId.getValue(), // Use id as slug for navigation
      communityId,
      authorId,
      beneficiaryId: beneficiaryId || undefined,
      content: publication.getContent,
      type: publication.getType,
      hashtags: publication.getHashtags,
      imageUrl: snapshot.imageUrl || undefined,
      images: snapshot.images || undefined,
      videoUrl: snapshot.videoUrl || undefined,
      title: publication.getTitle || undefined,
      description: publication.getDescription || undefined,
      postType: snapshot.postType || 'basic',
      isProject: snapshot.isProject || false,
      // Forwarding / review flow
      forwardStatus: snapshot.forwardStatus ?? null,
      forwardTargetCommunityId: snapshot.forwardTargetCommunityId || undefined,
      forwardProposedBy: snapshot.forwardProposedBy || undefined,
      forwardProposedAt: snapshot.forwardProposedAt || undefined,
      // Project taxonomy (needed for edit prefill + cards outside community feed)
      impactArea: snapshot.impactArea || undefined,
      stage: snapshot.stage || undefined,
      beneficiaries:
        snapshot.beneficiaries && snapshot.beneficiaries.length > 0
          ? snapshot.beneficiaries
          : undefined,
      methods:
        snapshot.methods && snapshot.methods.length > 0
          ? snapshot.methods
          : undefined,
      helpNeeded:
        snapshot.helpNeeded && snapshot.helpNeeded.length > 0
          ? snapshot.helpNeeded
          : undefined,
      metrics: {
        upvotes: publication.getMetrics.upvotes,
        downvotes: publication.getMetrics.downvotes,
        score: publication.getMetrics.score,
        commentCount: publication.getMetrics.commentCount,
        viewCount: 0, // Not available in current entity
      },
      meta: {
        author: UserFormatter.formatUserForApi(author, authorId),
        ...(beneficiary && beneficiaryId && {
          beneficiary: UserFormatter.formatUserForApi(
            beneficiary,
            beneficiaryId,
          ),
        }),
        ...(community && {
          origin: this.formatCommunityForApi(community),
        }),
      },
      deleted: snapshot.deleted ?? false,
      deletedAt: snapshot.deletedAt ? snapshot.deletedAt.toISOString() : undefined,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  }

  /**
   * Map Poll entity to API format
   */
  static mapPollToApi(
    poll: any, // Poll entity (using any since we don't have the exact type)
    usersMap: Map<string, any>,
    communitiesMap: Map<string, any>,
  ): any {
    const snapshot = poll.toSnapshot();
    const authorId = snapshot.authorId;
    const communityId = snapshot.communityId;
    const author = usersMap.get(authorId);
    const community = communitiesMap.get(communityId);

    return {
      id: snapshot.id,
      authorId,
      communityId,
      question: snapshot.question,
      description: snapshot.description,
      options: snapshot.options.map((opt: any) => ({
        id: opt.id,
        text: opt.text,
        votes: opt.votes,
        amount: opt.amount || 0,
        casterCount: opt.casterCount,
      })),
      metrics: snapshot.metrics,
      expiresAt: snapshot.expiresAt.toISOString(),
      isActive: snapshot.isActive,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
      // Add metadata for frontend compatibility with PublicationCard
      meta: {
        author: UserFormatter.formatUserForApi(author, authorId),
        ...(community && {
          origin: this.formatCommunityForApi(community),
        }),
      },
      // Add type field to indicate this is a poll (for PublicationCard compatibility)
      type: 'poll' as const,
      // Add content field using question for PublicationCard compatibility
      content: snapshot.question,
    };
  }

  /**
   * Map Comment entity to API format
   */
  static mapCommentToApi(
    comment: any, // Comment entity or vote (using any for flexibility)
    usersMap: Map<string, any>,
    publicationSlug?: string,
    communityId?: string,
  ): any {
    // Handle both Comment entities and Vote objects (votes contain comments)
    const authorId = comment.userId || comment.getAuthorId?.getValue();
    const author = usersMap.get(authorId);

    // Get images from entity or schema - check multiple sources
    const images = comment.images || 
                   comment.getImages?.() || 
                   (comment.snapshot?.images) || 
                   (comment.toSnapshot?.()?.images) ||
                   [];
    
    const baseComment = {
      id: comment.id || comment.getId?.getValue(),
      _id: comment.id || comment.getId?.getValue(),
      targetType: comment.targetType || comment.getTargetType,
      targetId: comment.targetId || comment.getTargetId,
      authorId,
      content: comment.comment || comment.content || comment.getContent,
      ...(images && Array.isArray(images) && images.length > 0 && { images }),
      createdAt:
        comment.createdAt?.toISOString?.() ||
        new Date(comment.createdAt).toISOString(),
      updatedAt:
        comment.updatedAt?.toISOString?.() ||
        comment.createdAt?.toISOString?.() ||
        new Date(comment.createdAt).toISOString(),
      ...(publicationSlug && { publicationSlug }),
      ...(communityId && { communityId }),
      meta: {
        author: UserFormatter.formatUserForApi(author, authorId),
      },
    };

    // Add vote transaction fields if this is a vote
    if (
      comment.amountQuota !== undefined ||
      comment.amountWallet !== undefined
    ) {
      const voteAmountQuota = comment.amountQuota || 0;
      const voteAmountWallet = comment.amountWallet || 0;
      const voteAmount = voteAmountQuota + voteAmountWallet;
      // Use stored direction field instead of inferring from amounts
      const isUpvote = comment.direction === 'up';
      const isDownvote = comment.direction === 'down';

      // Use images from baseComment (already extracted above)
      // Don't duplicate - images are already in baseComment if they exist
      
      return {
        ...baseComment,
        amountTotal: voteAmount,
        plus: isUpvote ? voteAmount : 0,
        minus: isDownvote ? voteAmount : 0,
        directionPlus: isUpvote,
        sum: isUpvote ? voteAmount : -voteAmount,
        // Images are already included in baseComment if they exist
      };
    }

    return baseComment;
  }

  /**
   * Map Vote to API format
   */
  static mapVoteToApi(vote: any, usersMap: Map<string, any>): any {
    const author = usersMap.get(vote.userId);

    return {
      ...vote,
      meta: {
        author: UserFormatter.formatUserForApi(author, vote.userId),
      },
    };
  }
}
