import {
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import {
  MeritTransferCreateInputSchema,
  type MeritTransferCreateInput,
} from '@meriter/shared-types/merit-transfer';
import { uid } from 'uid';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import {
  attendeeIdsFromParticipants,
  parseEventParticipantsFromDoc,
} from '../../../domain/common/helpers/event-participant.helper';
import { CommunityService } from '../../../domain/services/community.service';
import type {
  CreateMeritTransferPort,
  MeritTransferRecord,
} from '../../../domain/ports/create-merit-transfer.port';
import { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import { WalletService } from '../../../domain/services/wallet.service';
import type { WalletContextResolverService } from '../../../domain/services/wallet-context-resolver.service';
import type { MeritTransferPersistencePort } from '../../../domain/ports/merit-transfer.persistence.port';
import type { PublicationPersistencePort } from '../../../domain/ports/publication.persistence.port';
import type { MeritTransferGroupNotifyPort } from '../../../domain/ports/merit-transfer-group-notify.port';

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

/**
 * BC-15: peer merit transfer creation (P-10).
 * inv-06: wallet-only debits/credits; quota is never involved.
 */
export class CreateMeritTransferUseCase implements CreateMeritTransferPort {
  private readonly logger = new Logger(CreateMeritTransferUseCase.name);

  constructor(
    private readonly meritTransferPersistence: MeritTransferPersistencePort,
    private readonly publicationPersistence: PublicationPersistencePort,
    private readonly walletService: WalletService,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly walletContextResolverService: WalletContextResolverService,
    private readonly groupNotifyPort?: MeritTransferGroupNotifyPort,
  ) {}

  private toRecord(
    doc: Awaited<ReturnType<MeritTransferPersistencePort['create']>>,
  ): MeritTransferRecord {
    return {
      id: doc.id,
      senderId: doc.senderId,
      receiverId: doc.receiverId,
      amount: doc.amount,
      comment: doc.comment,
      sourceWalletType: doc.sourceWalletType,
      sourceContextId: doc.sourceContextId,
      targetWalletType: doc.targetWalletType,
      targetContextId: doc.targetContextId,
      communityContextId: doc.communityContextId,
      eventPostId: doc.eventPostId,
      createdAt: new Date(doc.createdAt).toISOString(),
      updatedAt: new Date(doc.updatedAt).toISOString(),
    };
  }

  private async resolveUserWalletCommunityId(contextId: string): Promise<string> {
    const community = await this.communityService.getCommunity(contextId);
    if (!community) {
      throw new NotFoundException('Wallet context community not found');
    }
    return this.walletContextResolverService.resolvePersonalWalletCommunityId(
      community,
      'voting',
    );
  }

  private async resolveSourceWalletId(input: MeritTransferCreateInput): Promise<string> {
    if (input.sourceWalletType === 'global') {
      return GLOBAL_COMMUNITY_ID;
    }
    return this.resolveUserWalletCommunityId(input.sourceContextId!);
  }

  private async resolveTargetWalletId(input: MeritTransferCreateInput): Promise<string> {
    if (input.targetWalletType === 'global') {
      return GLOBAL_COMMUNITY_ID;
    }
    return this.resolveUserWalletCommunityId(input.targetContextId!);
  }

  private async currencyForWalletCommunityId(walletCommunityId: string): Promise<{
    singular: string;
    plural: string;
    genitive: string;
  }> {
    const community = await this.communityService.getCommunity(walletCommunityId);
    return community?.settings?.currencyNames ?? DEFAULT_CURRENCY;
  }

  private parseCreateInput(raw: unknown): MeritTransferCreateInput {
    const parsed = MeritTransferCreateInputSchema.safeParse(raw);
    if (!parsed.success) {
      const msg =
        parsed.error.issues.map((i) => i.message).join('; ') || 'Invalid merit transfer input';
      throw new BadRequestException(msg);
    }
    return parsed.data;
  }

  /**
   * When `eventPostId` is set, the receiver must appear on the event RSVP list and be a community member.
   */
  private async validateEventLinkedTransfer(input: MeritTransferCreateInput): Promise<void> {
    if (!input.eventPostId) {
      return;
    }
    const pub = await this.publicationPersistence.findById(input.eventPostId);
    if (!pub) {
      throw new NotFoundException('Event publication not found');
    }
    if (pub.communityId !== input.communityContextId) {
      throw new BadRequestException('eventPostId does not belong to communityContextId');
    }
    if (pub.postType !== 'event') {
      throw new BadRequestException('eventPostId must reference a post with postType event');
    }
    const rows = parseEventParticipantsFromDoc(
      pub as { eventParticipants?: unknown; eventAttendees?: string[] },
    );
    const attendees = attendeeIdsFromParticipants(rows);
    if (!attendees.includes(input.receiverId)) {
      throw new BadRequestException(
        'When eventPostId is set, the receiver must be listed in the event attendees',
      );
    }
  }

  /**
   * Validates membership, balances, debits sender wallet, credits receiver wallet, persists MeritTransfer.
   */
  async execute(rawInput: unknown): Promise<MeritTransferRecord> {
    const input = this.parseCreateInput(rawInput);

    const contextCommunity = await this.communityService.getCommunity(input.communityContextId);
    if (!contextCommunity) {
      throw new NotFoundException('Community context not found');
    }

    const senderRole = await this.userCommunityRoleService.getRole(
      input.senderId,
      input.communityContextId,
    );
    const receiverRole = await this.userCommunityRoleService.getRole(
      input.receiverId,
      input.communityContextId,
    );
    if (!senderRole) {
      throw new BadRequestException('Sender is not a member of this community context');
    }
    if (!receiverRole) {
      throw new BadRequestException('Receiver is not a member of this community context');
    }
    if (input.eventPostId) {
      await this.validateEventLinkedTransfer(input);
    }

    const sourceWalletId = await this.resolveSourceWalletId(input);
    const targetWalletId = await this.resolveTargetWalletId(input);

    const sourceWallet = await this.walletService.getWallet(input.senderId, sourceWalletId);
    const balance = sourceWallet?.getBalance() ?? 0;
    if (balance < input.amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ${balance}, requested: ${input.amount}`,
      );
    }

    const sourceCurrency = await this.currencyForWalletCommunityId(sourceWalletId);
    const targetCurrency = await this.currencyForWalletCommunityId(targetWalletId);

    const id = uid();
    const created = await this.meritTransferPersistence.runInTransaction(
      async (session) => {
        await this.walletService.addTransaction(
          input.senderId,
          sourceWalletId,
          'debit',
          input.amount,
          'personal',
          'merit_transfer',
          id,
          sourceCurrency,
          'Merit transfer (sent)',
          session as ClientSession,
        );
        await this.walletService.addTransaction(
          input.receiverId,
          targetWalletId,
          'credit',
          input.amount,
          'personal',
          'merit_transfer',
          id,
          targetCurrency,
          'Merit transfer (received)',
          session as ClientSession,
        );
        return this.meritTransferPersistence.create(
          {
            id,
            senderId: input.senderId,
            receiverId: input.receiverId,
            amount: input.amount,
            comment: input.comment,
            sourceWalletType: input.sourceWalletType,
            sourceContextId:
              input.sourceWalletType === 'global' ? undefined : input.sourceContextId,
            targetWalletType: input.targetWalletType,
            targetContextId:
              input.targetWalletType === 'global' ? undefined : input.targetContextId,
            communityContextId: input.communityContextId,
            eventPostId: input.eventPostId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          session,
        );
      },
    );

    this.logger.log(
      `Merit transfer ${id}: ${input.senderId} → ${input.receiverId}, amount=${input.amount}, context=${input.communityContextId}`,
    );
    const record = this.toRecord(created);
    if (this.groupNotifyPort) {
      void this.groupNotifyPort.announceTransfer(record).catch((err) => {
        this.logger.warn(
          `Merit transfer group notify failed for ${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
    return record;
  }
}

export function createCreateMeritTransferUseCase(deps: {
  meritTransferPersistence: MeritTransferPersistencePort;
  publicationPersistence: PublicationPersistencePort;
  walletService: WalletService;
  communityService: CommunityService;
  userCommunityRoleService: UserCommunityRoleService;
  walletContextResolverService: WalletContextResolverService;
  groupNotifyPort?: MeritTransferGroupNotifyPort;
}): CreateMeritTransferUseCase {
  return new CreateMeritTransferUseCase(
    deps.meritTransferPersistence,
    deps.publicationPersistence,
    deps.walletService,
    deps.communityService,
    deps.userCommunityRoleService,
    deps.walletContextResolverService,
    deps.groupNotifyPort,
  );
}
