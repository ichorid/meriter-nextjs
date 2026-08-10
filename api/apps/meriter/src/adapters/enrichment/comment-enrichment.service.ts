import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../../domain/services/user.service';
import { PublicationService } from '../../domain/services/publication.service';
import { CommunityService } from '../../domain/services/community.service';
import { VoteService } from '../../domain/services/vote.service';
import { UserFormatter } from '../../api-v1/common/utils/user-formatter.util';

export interface EnrichedCommentData {
  author: any | null;
  beneficiary: any | null;
  community: any | null;
}

/**
 * Enriches comment/vote payloads with author, beneficiary, and community data.
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

  async fetchAuthor(authorId: string | undefined): Promise<any | null> {
    if (!authorId) {
      return null;
    }

    try {
      return await this.userService.getUser(authorId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to fetch author ${authorId}:`, errorMessage);
      return null;
    }
  }

  async fetchBeneficiaryAndCommunity(
    vote: any,
    authorId: string,
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
          const beneficiaryId =
            publication.getBeneficiaryId?.getValue() || publication.getAuthorId.getValue();

          if (beneficiaryId && beneficiaryId !== authorId) {
            try {
              const beneficiaryUser = await this.userService.getUser(beneficiaryId);
              if (beneficiaryUser) {
                beneficiary = UserFormatter.formatUserForApi(beneficiaryUser, beneficiaryId);
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              this.logger.warn(`Failed to fetch beneficiary ${beneficiaryId}:`, errorMessage);
            }
          }

          const communityId = publication.getCommunityId.getValue();
          if (communityId) {
            community = await this.fetchCommunity(communityId);
          }
        }
      } else if (vote.targetType === 'vote') {
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
              const errorMessage = error instanceof Error ? error.message : String(error);
              this.logger.warn(`Failed to fetch beneficiary ${targetAuthorId}:`, errorMessage);
            }
          }

          const communityId = targetVote.communityId;
          if (communityId) {
            community = await this.fetchCommunity(communityId);
          }
        }
      }
    } catch (error: unknown) {
      this.logger.warn(`Failed to fetch beneficiary/community for vote:`, (error as Error).message);
    }

    return { beneficiary, community };
  }

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
    } catch (error: unknown) {
      this.logger.warn(`Failed to fetch community ${communityId}:`, (error as Error).message);
    }
    return null;
  }
}
