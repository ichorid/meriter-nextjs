import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import {
  MeritTransferCreateInputSchema,
  type MeritTransferCreateInput,
} from '@meriter/shared-types';
import { uid } from 'uid';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import { isPriorityCommunity } from '../common/helpers/community.helper';
import {
  MeritTransferSchemaClass,
  MeritTransferDocument,
  type MeritTransferWalletType,
} from '../models/merit-transfer/merit-transfer.schema';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../models/publication/publication.schema';
import { WalletService } from './wallet.service';
import { CommunityService } from './community.service';
import { UserCommunityRoleService } from './user-community-role.service';
import {
  attendeeIdsFromParticipants,
  parseEventParticipantsFromDoc,
} from '../common/helpers/event-participant.helper';

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

export interface MeritTransferRecord {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  comment?: string;
  sourceWalletType: MeritTransferWalletType;
  sourceContextId?: string;
  targetWalletType: MeritTransferWalletType;
  targetContextId?: string;
  communityContextId: string;
  eventPostId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeritTransferListPagination {
  page?: number;
  limit?: number;
}

export interface MeritTransferListResult {
  data: MeritTransferRecord[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
}

@Injectable()
export class MeritTransferService {
  private readonly logger = new Logger(MeritTransferService.name);

  constructor(
    @InjectModel(MeritTransferSchemaClass.name)
    private readonly meritTransferModel: Model<MeritTransferDocument>,
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly walletService: WalletService,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
  ) {}

  private toRecord(doc: MeritTransferDocument): MeritTransferRecord {
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
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  /**
   * User wallet key: priority hubs use global storage (G-11), same as wallets.getByCommunity.
   */
  private async resolveUserWalletCommunityId(contextId: string): Promise<string> {
    const community = await this.communityService.getCommunity(contextId);
    if (!community) {
      throw new NotFoundException('Wallet context community not found');
    }
    if (isPriorityCommunity(community)) {
      return GLOBAL_COMMUNITY_ID;
    }
    return contextId;
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
    const pub = await this.publicationModel.findOne({ id: input.eventPostId }).lean();
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
  async create(rawInput: unknown): Promise<MeritTransferRecord> {
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
    const session = await this.connection.startSession();

    try {
      let created: MeritTransferDocument | null = null;
      await session.withTransaction(async () => {
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
          session,
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
          session,
        );
        const createdDocs = await this.meritTransferModel.create(
          [
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
            },
          ],
          { session },
        );
        const doc = createdDocs[0];
        if (!doc) {
          throw new BadRequestException('Merit transfer document was not created');
        }
        created = doc;
      });

      if (!created) {
        throw new BadRequestException('Merit transfer was not persisted');
      }

      this.logger.log(
        `Merit transfer ${id}: ${input.senderId} → ${input.receiverId}, amount=${input.amount}, context=${input.communityContextId}`,
      );
      return this.toRecord(created);
    } finally {
      await session.endSession();
    }
  }

  async getByCommunityContext(
    communityId: string,
    opts: MeritTransferListPagination = {},
  ): Promise<MeritTransferListResult> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const filter = { communityContextId: communityId };

    const [total, docs] = await Promise.all([
      this.meritTransferModel.countDocuments(filter).exec(),
      this.meritTransferModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
    ]);

    return {
      data: docs.map((d) => this.toRecord(d)),
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    };
  }

  async getByUser(
    userId: string,
    direction: 'incoming' | 'outgoing',
    opts: MeritTransferListPagination = {},
  ): Promise<MeritTransferListResult> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const filter =
      direction === 'incoming' ? { receiverId: userId } : { senderId: userId };

    const [total, docs] = await Promise.all([
      this.meritTransferModel.countDocuments(filter).exec(),
      this.meritTransferModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
    ]);

    return {
      data: docs.map((d) => this.toRecord(d)),
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    };
  }

  /** Transfers where the user sent or received merits (for profile activity counts). */
  async countTransfersInvolvingUser(userId: string): Promise<number> {
    return this.meritTransferModel.countDocuments({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });
  }
}
