import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ClientSession } from 'mongoose';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import type { Community } from '../models/community/community.schema';
import { isEligibleNonProjectBirzhaSourceCommunity } from '../common/constants/birzha-source-entity.constants';
import { CommunityService } from './community.service';
import { CommunityWalletService } from './community-wallet.service';
import { WalletService } from './wallet.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { NotificationService } from './notification.service';

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

export type PayoutLine = { userId: string; amount: number; bucket: 'founder' | 'investor' | 'team' };

function floor2(n: number): number {
  return Math.floor(n * 100) / 100;
}

@Injectable()
export class ProjectPayoutService {
  private readonly logger = new Logger(ProjectPayoutService.name);

  constructor(
    private readonly communityService: CommunityService,
    private readonly communityWalletService: CommunityWalletService,
    private readonly walletService: WalletService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly notificationService: NotificationService,
  ) {}

  async previewPayout(projectId: string, amount: number): Promise<{ lines: PayoutLine[]; totalCredits: number }> {
    if (!Number.isInteger(amount) || amount < 1) {
      throw new BadRequestException('Amount must be a positive integer');
    }
    const target = await this.requireWalletPayoutCommunity(projectId);
    const balance = await this.communityWalletService.getBalance(projectId);
    if (amount > balance) {
      throw new BadRequestException(
        `Insufficient project wallet balance. Available: ${balance}, requested: ${amount}`,
      );
    }
    return this.computeDistribution(target, projectId, amount);
  }

  async executePayout(
    projectId: string,
    amount: number,
    actorUserId: string,
    options?: { globalRole?: string | null; session?: ClientSession; skipArchivedCheck?: boolean },
  ): Promise<{ lines: PayoutLine[]; totalCredits: number }> {
    if (!Number.isInteger(amount) || amount < 1) {
      throw new BadRequestException('Amount must be a positive integer');
    }
    const target = await this.requireWalletPayoutCommunity(projectId);
    if (
      !options?.skipArchivedCheck &&
      target.isProject === true &&
      target.projectStatus === 'archived'
    ) {
      throw new BadRequestException('Cannot payout from an archived project');
    }

    const role = await this.userCommunityRoleService.getRole(actorUserId, projectId);
    const isLead = role?.role === 'lead';
    const isSuperadmin = options?.globalRole === 'superadmin';
    if (!isLead && !isSuperadmin) {
      throw new ForbiddenException('Only the project lead can pay out merits');
    }

    const balance = await this.communityWalletService.getBalance(projectId);
    if (amount > balance) {
      throw new BadRequestException(
        `Insufficient project wallet balance. Available: ${balance}, requested: ${amount}`,
      );
    }

    const { lines, totalCredits } = await this.computeDistribution(target, projectId, amount);
    const session = options?.session;

    const debitReason =
      target.isProject === true ? 'project_payout' : 'community_wallet_payout';
    await this.communityWalletService.debit(projectId, amount, debitReason);

    const globalComm = await this.communityService.getCommunity(GLOBAL_COMMUNITY_ID);
    const currency = globalComm?.settings?.currencyNames ?? DEFAULT_CURRENCY;

    for (const line of lines) {
      if (line.amount <= 0) continue;
      await this.walletService.addTransaction(
        line.userId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        line.amount,
        'personal',
        'project_payout',
        projectId,
        currency,
        `Project payout (${line.bucket})`,
        session,
      );
    }

    const leads = await this.userCommunityRoleService.getUsersByRole(projectId, 'lead');
    const participants = await this.userCommunityRoleService.getUsersByRole(projectId, 'participant');
    const memberIds = new Set([...leads.map((r) => r.userId), ...participants.map((r) => r.userId)]);
    const label = target.isProject === true ? 'project' : 'community';
    const yourAmountByUser = new Map<string, number>();
    for (const line of lines) {
      if (line.amount <= 0) continue;
      yourAmountByUser.set(
        line.userId,
        floor2((yourAmountByUser.get(line.userId) ?? 0) + line.amount),
      );
    }
    for (const memberId of memberIds) {
      try {
        const yourAmount = yourAmountByUser.get(memberId) ?? 0;
        await this.notificationService.createNotification({
          userId: memberId,
          type: 'project_distributed',
          source: 'system',
          metadata: {
            projectId,
            projectName: target.name,
            amount,
            totalCredits,
            totalPayout: amount,
            yourAmount,
            entityLabel: label,
          },
          title: target.isProject === true ? 'Project payout' : 'Community payout',
          message:
            target.isProject === true
              ? `Merits were paid out from project "${target.name}".`
              : `Merits were paid out from community "${target.name}".`,
        });
      } catch (err) {
        this.logger.warn(`Failed to notify ${memberId} about payout: ${err}`);
      }
    }

    this.logger.log(
      `${label} wallet payout ${projectId}: amount=${amount} credits=${totalCredits} actor=${actorUserId}`,
    );

    return { lines, totalCredits };
  }

  /**
   * Full wallet sweep (e.g. on project close). Skips archived check.
   */
  async executePayoutAll(
    projectId: string,
    actorUserId: string,
    options?: { globalRole?: string | null; session?: ClientSession },
  ): Promise<{ lines: PayoutLine[]; totalCredits: number; amount: number } | null> {
    const balance = await this.communityWalletService.getBalance(projectId);
    if (balance < 1) {
      return null;
    }
    const amount = Math.floor(balance);
    const result = await this.executePayout(projectId, amount, actorUserId, {
      ...options,
      skipArchivedCheck: true,
    });
    return { ...result, amount };
  }

  /**
   * Project (isProject) or eligible non-project Birzha source community (team/custom).
   */
  private async requireWalletPayoutCommunity(communityId: string): Promise<Community> {
    const c = await this.communityService.getCommunity(communityId);
    if (!c) {
      throw new NotFoundException('Community not found');
    }
    if (c.isProject === true) {
      return c;
    }
    if (isEligibleNonProjectBirzhaSourceCommunity(c)) {
      return c;
    }
    throw new NotFoundException('Wallet payouts are not available for this community');
  }

  private async computeDistribution(
    project: Community,
    projectId: string,
    T: number,
  ): Promise<{ lines: PayoutLine[]; totalCredits: number }> {
    const lines: PayoutLine[] = [];

    const leads = await this.userCommunityRoleService.getUsersByRole(projectId, 'lead');
    const participants = await this.userCommunityRoleService.getUsersByRole(projectId, 'participant');
    const memberUserIds = [...new Set([...leads.map((r) => r.userId), ...participants.map((r) => r.userId)])];

    let founderUserId = project.founderUserId;
    if (!founderUserId && leads[0]) {
      founderUserId = leads[0].userId;
    }
    if (!founderUserId) {
      throw new BadRequestException('Project has no founder or lead');
    }

    const founderSharePercent = project.founderSharePercent ?? 0;
    const investingEnabled = project.settings?.investingEnabled === true;
    const investorSharePercent = investingEnabled ? (project.investorSharePercent ?? 0) : 0;
    const investments = project.projectInvestments ?? [];

    const founderAmt = floor2((T * founderSharePercent) / 100);
    if (founderAmt > 0) {
      lines.push({ userId: founderUserId, amount: founderAmt, bucket: 'founder' });
    }

    const investorGross = floor2((T * investorSharePercent) / 100);
    const investmentTotal = investments.reduce((s, i) => s + (i.amount ?? 0), 0);

    let investorPaid = 0;
    if (investmentTotal > 0 && investorGross > 0) {
      for (const inv of investments) {
        if (inv.amount <= 0) continue;
        const share = floor2((investorGross * inv.amount) / investmentTotal);
        if (share > 0) {
          lines.push({ userId: inv.userId, amount: share, bucket: 'investor' });
          investorPaid += share;
        }
      }
    }

    const investorRemainder = investorGross - investorPaid;
    const teamPool = floor2(T - founderAmt - investorGross + investorRemainder);

    const weights = new Map<string, number>();
    for (const uid of memberUserIds) {
      const w = await this.walletService.getWallet(uid, projectId);
      const b = w ? w.getBalance() : 0;
      if (b > 0) {
        weights.set(uid, b);
      }
    }

    const totalWeight = Array.from(weights.values()).reduce((a, b) => a + b, 0);
    if (teamPool > 0 && totalWeight > 0) {
      const entries = Array.from(weights.entries());
      let remaining = teamPool;
      for (let i = 0; i < entries.length; i++) {
        const [uid, w] = entries[i];
        const isLast = i === entries.length - 1;
        const share = isLast ? floor2(remaining) : floor2((teamPool * w) / totalWeight);
        if (share > 0) {
          lines.push({ userId: uid, amount: share, bucket: 'team' });
          remaining = floor2(remaining - share);
        }
      }
    } else if (teamPool > 0) {
      // No in-project wallet balances to weight the team pool — credit founder/lead (avoids burning merits on debit).
      lines.push({ userId: founderUserId, amount: teamPool, bucket: 'team' });
    }

    const byUser = new Map<string, { amount: number; bucket: PayoutLine['bucket'] }>();
    for (const line of lines) {
      const prev = byUser.get(line.userId);
      const nextAmt = floor2((prev?.amount ?? 0) + line.amount);
      const bucket =
        line.bucket === 'founder' || prev?.bucket === 'founder'
          ? 'founder'
          : line.bucket === 'investor' || prev?.bucket === 'investor'
            ? 'investor'
            : 'team';
      byUser.set(line.userId, { amount: nextAmt, bucket });
    }

    const merged: PayoutLine[] = Array.from(byUser.entries())
      .map(([userId, v]) => ({ userId, amount: v.amount, bucket: v.bucket }))
      .filter((l) => l.amount > 0);

    const totalCredits = merged.reduce((s, l) => s + l.amount, 0);
    return { lines: merged, totalCredits };
  }
}
