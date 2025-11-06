import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../../../domain/services/user.service';
import { PublicationService } from '../../../domain/services/publication.service';
import { CommunityService } from '../../../domain/services/community.service';
import { VoteService } from '../../../domain/services/vote.service';
import { UserFormatter } from '../utils/user-formatter.util';

export interface EnrichedCommentData {
  author: any | null;
  beneficiary: any | null;
  community: any | null;
}

/**
 * Service for enriching comment data with author, beneficiary, and community information
 */
@Injectable()
export class CommentEnrichmentService {
  private readonly logger = new Logger(CommentEnrichmentService.name);

  constructor(
    private readonly userService: UserService,
    private readonly publicationService: PublicationService,
    private readonly communityService: CommunityService,
    private readonly voteService: VoteService,
  ) {}

  /**
   * Fetch author data
   */
  async fetchAuthor(authorId: string | undefined): Promise<any | null> {
    if (!authorId) {
      return null;
    }

    try {
      return await this.userService.getUser(authorId);
    } catch (error) {
      this.logger.warn(`Failed to fetch author ${authorId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch beneficiary and community data for a vote
   */
  async fetchBeneficiaryAndCommunity(
    vote: any,
    authorId: string
  ): Promise<{ beneficiary: any | null; community: any | null }> {
    let beneficiary: any | null = null;
    let community: any | null = null;

    if (!vote) {
      return { beneficiary, community };
    }

    try {
      if (vote.targetType === 'publication') {
        const publication = await this.publicationService.getPublication(vote.targetId);
        if (publication) {
          // Get beneficiary (beneficiaryId if set, otherwise authorId)
          const beneficiaryId = publication.getBeneficiaryId?.getValue() || publication.getAuthorId.getValue();

          // Fetch beneficiary user
          if (beneficiaryId && beneficiaryId !== authorId) {
            try {
              const beneficiaryUser = await this.userService.getUser(beneficiaryId);
              if (beneficiaryUser) {
                beneficiary = UserFormatter.formatUserForApi(beneficiaryUser, beneficiaryId);
              }
            } catch (error) {
              this.logger.warn(`Failed to fetch beneficiary ${beneficiaryId}:`, error.message);
            }
          }

          // Fetch community
          const communityId = publication.getCommunityId.getValue();
          if (communityId) {
            community = await this.fetchCommunity(communityId);
          }
        }
      } else if (vote.targetType === 'vote') {
        // Vote is on another vote - fetch the target vote's author as beneficiary
        const targetVote = await this.voteService.getVoteById(vote.targetId);
        if (targetVote) {
          const targetAuthorId = targetVote.userId;
          if (targetAuthorId && targetAuthorId !== vote.userId) {
            try {
              const beneficiaryUser = await this.userService.getUser(targetAuthorId);
              if (beneficiaryUser) {
                beneficiary = UserFormatter.formatUserForApi(beneficiaryUser, targetAuthorId);
              }
            } catch (error) {
              this.logger.warn(`Failed to fetch beneficiary ${targetAuthorId}:`, error.message);
            }
          }

          // Get community from the target vote
          const communityId = targetVote.communityId;
          if (communityId) {
            community = await this.fetchCommunity(communityId);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch beneficiary/community for vote:`, error.message);
    }

    return { beneficiary, community };
  }

  /**
   * Fetch community data
   */
  private async fetchCommunity(communityId: string): Promise<any | null> {
    try {
      const communityData = await this.communityService.getCommunity(communityId);
      if (communityData) {
        return {
          id: communityData.id,
          name: communityData.name,
          avatarUrl: communityData.avatarUrl,
          iconUrl: communityData.settings?.iconUrl,
        };
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch community ${communityId}:`, error.message);
    }
    return null;
  }
}

