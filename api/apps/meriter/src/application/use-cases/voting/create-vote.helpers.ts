import { NotFoundException } from '@nestjs/common';
import type { Connection } from 'mongoose';
import {
  isPriorityCommunity,
  isTelegramLinkedCommunity,
} from '../../../domain/common/helpers/community.helper';
import {
  getCommunityIdForDocumentVoteTarget,
  isDocumentVoteTargetType,
} from './document-vote.helper';
import { isPublicationEntitySourced } from '../../../domain/common/helpers/publication-source.helper';
import type { CommunityService } from '../../../domain/services/community.service';
import type { DocumentService } from '../../../domain/services/document.service';
import type { PublicationService } from '../../../domain/services/publication.service';
import type { VoteService } from '../../../domain/services/vote.service';
import type { WalletService } from '../../../domain/services/wallet.service';

/** Remaining voting quota (votes + quota_usage; excludes poll_casts — legacy vote path). */
export async function getRemainingQuota(
  userId: string,
  communityId: string,
  community: Parameters<CommunityService['getEffectiveMeritSettings']>[0],
  communityService: CommunityService,
  connection: Connection,
): Promise<number> {
  if (isPriorityCommunity(community)) {
    return 0;
  }

  if (community?.meritSettings?.quotaEnabled === false) {
    return 0;
  }

  const effectiveMeritSettings = communityService.getEffectiveMeritSettings(community);
  const dailyQuota =
    typeof effectiveMeritSettings?.dailyQuota === 'number'
      ? effectiveMeritSettings.dailyQuota
      : 0;

  if (dailyQuota <= 0) {
    return 0;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const quotaStartTime = community.lastQuotaResetAt
    ? new Date(community.lastQuotaResetAt)
    : today;

  if (!connection.db) {
    throw new Error('Database connection not available');
  }

  const [votesUsed, quotaUsageUsed] = await Promise.all([
    connection.db
      .collection('votes')
      .aggregate([
        {
          $match: {
            userId,
            communityId,
            createdAt: { $gte: quotaStartTime },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountQuota' },
          },
        },
      ])
      .toArray(),
    connection.db
      .collection('quota_usage')
      .aggregate([
        {
          $match: {
            userId,
            communityId,
            createdAt: { $gte: quotaStartTime },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountQuota' },
          },
        },
      ])
      .toArray(),
  ]);

  const votesTotal = votesUsed.length > 0 && votesUsed[0] ? (votesUsed[0].total as number) : 0;
  const quotaUsageTotal =
    quotaUsageUsed.length > 0 && quotaUsageUsed[0] ? (quotaUsageUsed[0].total as number) : 0;
  const used = votesTotal + quotaUsageTotal;
  return Math.max(0, dailyQuota - used);
}

export async function getWalletBalance(
  userId: string,
  communityId: string,
  walletService: WalletService,
): Promise<number> {
  const wallet = await walletService.getWallet(userId, communityId);
  return wallet ? wallet.getBalance() : 0;
}

export function ticketHasWorkAccepted(
  doc: { ticketActivityLog?: Array<{ action?: string }> } | null | undefined,
): boolean {
  return (doc?.ticketActivityLog ?? []).some((e) => e.action === 'work_accepted');
}

/** Effective merit recipient for a publication vote (beneficiary if set, else author). */
export function getPublicationEffectiveBeneficiaryId(publicationDoc: {
  beneficiaryId?: string | null;
  authorId?: string;
} | null | undefined): string | null {
  if (!publicationDoc?.authorId) {
    return null;
  }
  return publicationDoc.beneficiaryId ?? publicationDoc.authorId;
}

/** Author adding merits to own post rating (not a nomination for someone else). */
export function isPublicationAuthorMeritTopup(
  publicationDoc: {
    authorId?: string;
    beneficiaryId?: string | null;
  } | null | undefined,
  userId: string,
): boolean {
  if (!publicationDoc?.authorId || publicationDoc.authorId !== userId) {
    return false;
  }
  if (isPublicationEntitySourced(publicationDoc)) {
    return false;
  }
  return getPublicationEffectiveBeneficiaryId(publicationDoc) === userId;
}

/** Telegram MVP: up/down votes mirror to author wallet immediately (no post withdraw). */
export function shouldUseTelegramInstantWalletMirror(
  community: { telegramChatId?: string | null } | null | undefined,
  publicationDoc: unknown | null | undefined,
  totalAmount: number,
): boolean {
  if (!publicationDoc || totalAmount <= 0) {
    return false;
  }
  return isTelegramLinkedCommunity(community);
}

export function shouldUseProjectInstantAppreciation(
  community: { isProject?: boolean } | null | undefined,
  publicationDoc: {
    postType?: string;
    ticketStatus?: string;
    status?: string;
    beneficiaryId?: string | null;
    authorId?: string;
    ticketActivityLog?: Array<{ action?: string }>;
  } | null | undefined,
  direction: 'up' | 'down',
  totalAmount: number,
): boolean {
  if (!community?.isProject || direction !== 'up' || totalAmount <= 0 || !publicationDoc) {
    return false;
  }
  const pt = publicationDoc.postType;
  if (pt === 'discussion') {
    return (publicationDoc.status ?? 'active') !== 'closed';
  }
  if (pt === 'ticket') {
    return (
      publicationDoc.ticketStatus === 'closed' && ticketHasWorkAccepted(publicationDoc)
    );
  }
  return false;
}

export async function getCommunityIdFromTarget(
  targetType: 'publication' | 'vote' | 'document-variant' | 'document-block-official',
  targetId: string,
  publicationService: PublicationService,
  voteService: VoteService,
  documentService: DocumentService,
): Promise<string> {
  if (isDocumentVoteTargetType(targetType)) {
    return getCommunityIdForDocumentVoteTarget(documentService, targetType, targetId);
  }
  if (targetType === 'publication') {
    const publication = await publicationService.getPublication(targetId);
    if (!publication) {
      throw new NotFoundException('Publication not found');
    }
    return publication.getCommunityId.getValue();
  }
  const vote = await voteService.getVoteById(targetId);
  if (!vote) {
    throw new NotFoundException('Vote not found');
  }
  return vote.communityId;
}
