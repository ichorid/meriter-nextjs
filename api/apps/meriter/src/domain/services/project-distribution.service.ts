import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import { CommunityService } from './community.service';
import { TicketService } from './ticket.service';
import { WalletService } from './wallet.service';
import { CommunityWalletService } from './community-wallet.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { NotificationService } from './notification.service';

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

/**
 * Distributes author share from a Birzha project post to project members.
 * Flow: authorShare → founder fixed % + team pool by internal merits.
 * CommunityWallet.balance is NOT changed; only totalDistributed is incremented.
 */
@Injectable()
export class ProjectDistributionService {
  private readonly logger = new Logger(ProjectDistributionService.name);

  constructor(
    private readonly communityService: CommunityService,
    private readonly ticketService: TicketService,
    private readonly walletService: WalletService,
    private readonly communityWalletService: CommunityWalletService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Distribute authorShare to project members: founder fixed % + team pool by shares.
   * Rounds each share to 2 decimals; remainder goes to founder.
   */
  async distribute(projectId: string, authorShare: number): Promise<void> {
    if (authorShare <= 0) {
      throw new BadRequestException('Author share must be positive');
    }

    const project = await this.communityService.getCommunity(projectId);
    if (!project?.isProject) {
      throw new NotFoundException('Project not found');
    }

    const founderUserId =
      project.founderUserId ??
      (await this.userCommunityRoleService.getUsersByRole(projectId, 'lead'))[0]
        ?.userId;
    if (!founderUserId) {
      throw new BadRequestException('Project has no lead/founder');
    }

    const founderSharePercent = project.founderSharePercent ?? 0;
    const shares = await this.ticketService.getProjectShares(projectId);
    const totalActive = shares.reduce((s, r) => s + r.internalMerits, 0);
    const totalFrozen = await this.userCommunityRoleService.getTotalFrozenInternalMerits(projectId);
    const totalInternalMerits = totalActive + totalFrozen;

    if (totalInternalMerits === 0) {
      await this.walletService.addTransaction(
        founderUserId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        authorShare,
        'personal',
        'project_distribution',
        projectId,
        DEFAULT_CURRENCY,
        'Project distribution (no internal merits)',
      );
      await this.communityWalletService.addTotalDistributed(projectId, authorShare);
      const leadsEarly = await this.userCommunityRoleService.getUsersByRole(projectId, 'lead');
      const participantsEarly = await this.userCommunityRoleService.getUsersByRole(
        projectId,
        'participant',
      );
      const memberIdsEarly = new Set([
        ...leadsEarly.map((r) => r.userId),
        ...participantsEarly.map((r) => r.userId),
      ]);
      for (const memberId of memberIdsEarly) {
        try {
          const yourAmount = memberId === founderUserId ? authorShare : 0;
          await this.notificationService.createNotification({
            userId: memberId,
            type: 'project_distributed',
            source: 'system',
            metadata: {
              projectId,
              projectName: project.name,
              amount: authorShare,
              totalPayout: authorShare,
              yourAmount,
              entityLabel: 'project',
            },
            title: 'Project distribution',
            message: `Merits were distributed for project "${project.name}".`,
          });
        } catch (err) {
          this.logger.warn(`Failed to notify member ${memberId} about distribution: ${err}`);
        }
      }
      this.logger.log(
        `Distributed ${authorShare} to founder ${founderUserId} (totalInternalMerits=0)`,
      );
      return;
    }

    const founderFixed =
      Math.floor((authorShare * founderSharePercent) / 100 * 100) / 100;
    const teamPool = authorShare - founderFixed;

    const roundedShares = new Map<string, number>();
    for (const row of shares) {
      const share =
        (teamPool * row.internalMerits) / totalInternalMerits;
      const rounded = Math.floor(share * 100) / 100;
      roundedShares.set(
        row.userId,
        (roundedShares.get(row.userId) ?? 0) + rounded,
      );
    }

    const sumRounded = Array.from(roundedShares.values()).reduce((a, b) => a + b, 0);
    const remainder = Math.round((authorShare - founderFixed - sumRounded) * 100) / 100;

    const founderTeamShare = roundedShares.get(founderUserId) ?? 0;
    for (const [userId, amount] of roundedShares) {
      if (amount <= 0) continue;
      if (userId === founderUserId) continue;
      await this.walletService.addTransaction(
        userId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        amount,
        'personal',
        'project_distribution',
        projectId,
        DEFAULT_CURRENCY,
        'Project distribution (team share)',
      );
    }

    const founderTotal = founderFixed + founderTeamShare + remainder;
    if (founderTotal > 0) {
      await this.walletService.addTransaction(
        founderUserId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        founderTotal,
        'personal',
        'project_distribution',
        projectId,
        DEFAULT_CURRENCY,
        'Project distribution (founder fixed + remainder)',
      );
    }

    await this.communityWalletService.addTotalDistributed(projectId, authorShare);

    const yourAmountByUser = new Map<string, number>();
    for (const [uid, amt] of roundedShares) {
      if (amt <= 0 || uid === founderUserId) continue;
      yourAmountByUser.set(uid, amt);
    }
    yourAmountByUser.set(founderUserId, founderTotal);

    const leads = await this.userCommunityRoleService.getUsersByRole(projectId, 'lead');
    const participants = await this.userCommunityRoleService.getUsersByRole(projectId, 'participant');
    const memberIds = new Set([...leads.map((r) => r.userId), ...participants.map((r) => r.userId)]);
    for (const memberId of memberIds) {
      try {
        await this.notificationService.createNotification({
          userId: memberId,
          type: 'project_distributed',
          source: 'system',
          metadata: {
            projectId,
            projectName: project.name,
            amount: authorShare,
            totalPayout: authorShare,
            yourAmount: yourAmountByUser.get(memberId) ?? 0,
            entityLabel: 'project',
          },
          title: 'Project distribution',
          message: `Merits were distributed for project "${project.name}".`,
        });
      } catch (err) {
        this.logger.warn(`Failed to notify member ${memberId} about distribution: ${err}`);
      }
    }

    this.logger.log(
      `Distributed ${authorShare} for project ${projectId}: founderFixed=${founderFixed}, teamPool=${teamPool}, remainder=${remainder}`,
    );
  }
}
