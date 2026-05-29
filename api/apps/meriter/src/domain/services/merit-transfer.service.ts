import { Injectable, Inject } from '@nestjs/common';
import {
  createCreateMeritTransferUseCase,
  CreateMeritTransferUseCase,
} from '../../application/use-cases/merit-transfer/create-merit-transfer.use-case';
import {
  type MeritTransferWalletType,
} from '../models/merit-transfer/merit-transfer.schema';
import { WalletService } from './wallet.service';
import { CommunityService } from './community.service';
import { UserCommunityRoleService } from './user-community-role.service';
import {
  MERIT_TRANSFER_PERSISTENCE_PORT,
  type MeritTransferPersistencePort,
} from '../ports/merit-transfer.persistence.port';
import {
  PUBLICATION_PERSISTENCE_PORT,
  type PublicationPersistencePort,
} from '../ports/publication.persistence.port';

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
  private readonly createMeritTransferUseCase: CreateMeritTransferUseCase;

  constructor(
    @Inject(MERIT_TRANSFER_PERSISTENCE_PORT)
    private readonly meritTransferPersistence: MeritTransferPersistencePort,
    @Inject(PUBLICATION_PERSISTENCE_PORT)
    private readonly publicationPersistence: PublicationPersistencePort,
    private readonly walletService: WalletService,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
  ) {
    this.createMeritTransferUseCase = createCreateMeritTransferUseCase({
      meritTransferPersistence: this.meritTransferPersistence,
      publicationPersistence: this.publicationPersistence,
      walletService: this.walletService,
      communityService: this.communityService,
      userCommunityRoleService: this.userCommunityRoleService,
    });
  }

  private toRecord(
    doc: Awaited<ReturnType<MeritTransferPersistencePort['findMany']>>[number],
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
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private normalizeListPagination(opts: MeritTransferListPagination = {}): {
    page: number;
    limit: number;
    skip: number;
  } {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  private async listTransfers(
    filter: Record<string, unknown>,
    opts: MeritTransferListPagination = {},
  ): Promise<MeritTransferListResult> {
    const { page, limit, skip } = this.normalizeListPagination(opts);

    const [total, docs] = await Promise.all([
      this.meritTransferPersistence.count(filter),
      this.meritTransferPersistence.findMany(filter, {
        sort: { createdAt: -1 },
        skip,
        limit,
      }),
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

  /** Delegates to CreateMeritTransferUseCase (BC-15 / P-10). */
  async create(rawInput: unknown): Promise<MeritTransferRecord> {
    return this.createMeritTransferUseCase.execute(rawInput);
  }

  async getByCommunityContext(
    communityId: string,
    opts: MeritTransferListPagination = {},
  ): Promise<MeritTransferListResult> {
    return this.listTransfers({ communityContextId: communityId }, opts);
  }

  async getByUser(
    userId: string,
    direction: 'incoming' | 'outgoing',
    opts: MeritTransferListPagination = {},
  ): Promise<MeritTransferListResult> {
    const filter =
      direction === 'incoming' ? { receiverId: userId } : { senderId: userId };
    return this.listTransfers(filter, opts);
  }

  /** Transfers where the user sent or received merits (for profile activity counts). */
  async countTransfersInvolvingUser(userId: string): Promise<number> {
    return this.meritTransferPersistence.count({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });
  }
}
