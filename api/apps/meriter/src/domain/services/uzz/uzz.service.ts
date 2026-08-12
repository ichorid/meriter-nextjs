import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { uid } from 'uid';
import {
  UzzSettingsSchemaClass,
  UzzSettingsDocument,
  UZZ_SETTINGS_DEFAULTS,
  type UzzPurchaseGate,
  type UzzBankTransferMode,
  type UzzNotifyFlags,
} from '../../models/uzz/uzz-settings.schema';
import {
  UzzBankSchemaClass,
  UzzBankDocument,
  type UzzBankStatus,
} from '../../models/uzz/uzz-bank.schema';
import { UzzLotSchemaClass, UzzLotDocument } from '../../models/uzz/uzz-lot.schema';
import {
  UzzDealSchemaClass,
  UzzDealDocument,
  type UzzDealStatus,
} from '../../models/uzz/uzz-deal.schema';
import { UzzLedgerSchemaClass, UzzLedgerDocument } from '../../models/uzz/uzz-ledger.schema';
import {
  UzzIdentityLinkSchemaClass,
  UzzIdentityLinkDocument,
} from '../../models/uzz/uzz-identity-link.schema';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../../models/publication/publication.schema';
import { WalletService } from '../wallet.service';
import { UserService } from '../user.service';
import { CommunityService } from '../community.service';

export type UzzSettingsPatch = Partial<{
  emissionThreshold: number;
  bankInitialHops: number;
  demurrageRubPerDay: number;
  nominalFloorRub: number;
  minLotsToBuy: number;
  purchaseGate: UzzPurchaseGate;
  bankTransferMode: UzzBankTransferMode;
  dealRequestTtlHours: number;
  dealFulfillmentDays: number;
  notifyFlags: Partial<UzzNotifyFlags>;
}>;

const LINK_CODE_TTL_MS = 30 * 60 * 1000;
const DEAL_FEE_MERITS = 1;

@Injectable()
export class UzzService {
  constructor(
    @InjectModel(UzzSettingsSchemaClass.name)
    private readonly settingsModel: Model<UzzSettingsDocument>,
    @InjectModel(UzzBankSchemaClass.name)
    private readonly bankModel: Model<UzzBankDocument>,
    @InjectModel(UzzLotSchemaClass.name)
    private readonly lotModel: Model<UzzLotDocument>,
    @InjectModel(UzzDealSchemaClass.name)
    private readonly dealModel: Model<UzzDealDocument>,
    @InjectModel(UzzLedgerSchemaClass.name)
    private readonly ledgerModel: Model<UzzLedgerDocument>,
    @InjectModel(UzzIdentityLinkSchemaClass.name)
    private readonly identityModel: Model<UzzIdentityLinkDocument>,
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
    private readonly walletService: WalletService,
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
  ) {}

  async getOrCreateSettings(communityId: string): Promise<UzzSettingsDocument> {
    const existing = await this.settingsModel.findOne({ communityId }).exec();
    if (existing) return existing;
    return this.settingsModel.create({
      communityId,
      ...UZZ_SETTINGS_DEFAULTS,
      notifyFlags: { ...UZZ_SETTINGS_DEFAULTS.notifyFlags },
    });
  }

  async updateSettings(
    communityId: string,
    patch: UzzSettingsPatch,
  ): Promise<UzzSettingsDocument> {
    const settings = await this.getOrCreateSettings(communityId);
    if (patch.emissionThreshold !== undefined) {
      settings.emissionThreshold = patch.emissionThreshold;
    }
    if (patch.bankInitialHops !== undefined) {
      settings.bankInitialHops = patch.bankInitialHops;
    }
    if (patch.demurrageRubPerDay !== undefined) {
      settings.demurrageRubPerDay = patch.demurrageRubPerDay;
    }
    if (patch.nominalFloorRub !== undefined) {
      settings.nominalFloorRub = patch.nominalFloorRub;
    }
    if (patch.minLotsToBuy !== undefined) {
      settings.minLotsToBuy = patch.minLotsToBuy;
    }
    if (patch.purchaseGate !== undefined) {
      settings.purchaseGate = patch.purchaseGate;
    }
    if (patch.bankTransferMode !== undefined) {
      settings.bankTransferMode = patch.bankTransferMode;
    }
    if (patch.dealRequestTtlHours !== undefined) {
      settings.dealRequestTtlHours = patch.dealRequestTtlHours;
    }
    if (patch.dealFulfillmentDays !== undefined) {
      settings.dealFulfillmentDays = patch.dealFulfillmentDays;
    }
    if (patch.notifyFlags) {
      settings.notifyFlags = { ...settings.notifyFlags, ...patch.notifyFlags };
    }
    await settings.save();
    await this.appendLedger(communityId, 'settings_updated', { patch }, undefined);
    return settings;
  }

  async maybeEmitBankForPublication(publicationId: string): Promise<UzzBankDocument | null> {
    const publication = await this.publicationModel.findOne({ id: publicationId }).exec();
    if (!publication || publication.deleted) return null;

    const existing = await this.bankModel.findOne({ sourcePublicationId: publicationId }).exec();
    if (existing) return existing;

    const settings = await this.getOrCreateSettings(publication.communityId);
    const score = publication.metrics?.score ?? 0;
    if (score < settings.emissionThreshold) return null;

    const linked = await this.hasFullIdentityLink(publication.authorId);
    const status: UzzBankStatus = linked ? 'awaiting_nominal' : 'holding';
    const now = new Date();
    const bank = await this.bankModel.create({
      id: uid(),
      communityId: publication.communityId,
      ownerId: publication.authorId,
      sourcePublicationId: publicationId,
      hopsLeft: settings.bankInitialHops,
      nominalRub: null,
      status,
      ownerHistory: [
        {
          userId: publication.authorId,
          at: now,
          reason: linked ? 'emission' : 'emission_holding',
        },
      ],
    });

    await this.appendLedger(
      publication.communityId,
      'bank_emitted',
      { status, score, emissionThreshold: settings.emissionThreshold },
      publication.authorId,
      bank.id,
    );
    return bank;
  }

  async setBankNominal(
    bankId: string,
    nominalRub: number,
    adminUserId: string,
  ): Promise<UzzBankDocument> {
    if (!Number.isFinite(nominalRub) || nominalRub <= 0) {
      throw new BadRequestException('nominalRub must be a positive number');
    }
    const bank = await this.requireBank(bankId);
    if (bank.status !== 'awaiting_nominal' && bank.status !== 'holding') {
      throw new BadRequestException('Bank is not awaiting nominal');
    }
    const linked = await this.hasFullIdentityLink(bank.ownerId);
    if (!linked) {
      throw new BadRequestException('Owner must link Telegram and email before nominal');
    }
    bank.nominalRub = Math.round(nominalRub);
    bank.status = 'active';
    await bank.save();
    await this.appendLedger(
      bank.communityId,
      'bank_nominal_set',
      { nominalRub: bank.nominalRub, adminUserId },
      adminUserId,
      bank.id,
    );
    return bank;
  }

  async listMyBanks(userId: string, communityId: string): Promise<UzzBankDocument[]> {
    const ownerIds = await this.resolveLinkedUserIds(userId);
    return this.bankModel
      .find({ ownerId: { $in: ownerIds }, communityId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async adminListAwaitingNominal(communityId: string): Promise<UzzBankDocument[]> {
    return this.bankModel
      .find({ communityId, status: 'awaiting_nominal' })
      .sort({ createdAt: 1 })
      .exec();
  }

  async createLot(input: {
    communityId: string;
    authorId: string;
    title: string;
    description?: string;
    priceRub: number;
  }): Promise<UzzLotDocument> {
    if (!input.title.trim()) {
      throw new BadRequestException('title is required');
    }
    if (!Number.isFinite(input.priceRub) || input.priceRub <= 0) {
      throw new BadRequestException('priceRub must be positive');
    }
    return this.lotModel.create({
      id: uid(),
      communityId: input.communityId,
      authorId: input.authorId,
      title: input.title.trim(),
      description: (input.description ?? '').trim(),
      priceRub: Math.round(input.priceRub),
      active: true,
    });
  }

  async updateLot(
    lotId: string,
    authorId: string,
    patch: Partial<{ title: string; description: string; priceRub: number; active: boolean }>,
  ): Promise<UzzLotDocument> {
    const lot = await this.lotModel.findOne({ id: lotId }).exec();
    if (!lot) throw new NotFoundException('Lot not found');
    if (lot.authorId !== authorId) {
      throw new ForbiddenException('Only the lot author can update it');
    }
    if (patch.title !== undefined) lot.title = patch.title.trim();
    if (patch.description !== undefined) lot.description = patch.description.trim();
    if (patch.priceRub !== undefined) {
      if (!Number.isFinite(patch.priceRub) || patch.priceRub <= 0) {
        throw new BadRequestException('priceRub must be positive');
      }
      lot.priceRub = Math.round(patch.priceRub);
    }
    if (patch.active !== undefined) lot.active = patch.active;
    await lot.save();
    return lot;
  }

  async listLots(communityId: string): Promise<UzzLotDocument[]> {
    return this.lotModel
      .find({ communityId, active: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  async myLots(userId: string, communityId: string): Promise<UzzLotDocument[]> {
    const authorIds = await this.resolveLinkedUserIds(userId);
    return this.lotModel
      .find({ authorId: { $in: authorIds }, communityId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async canBuy(
    userId: string,
    communityId: string,
  ): Promise<{ allowed: boolean; reason?: string; activeLotCount: number; minLotsToBuy: number }> {
    const settings = await this.getOrCreateSettings(communityId);
    const authorIds = await this.resolveLinkedUserIds(userId);
    const activeLotCount = await this.lotModel.countDocuments({
      authorId: { $in: authorIds },
      communityId,
      active: true,
    });
    if (
      settings.purchaseGate === 'require_min_lots' &&
      activeLotCount < settings.minLotsToBuy
    ) {
      return {
        allowed: false,
        reason: 'require_min_lots',
        activeLotCount,
        minLotsToBuy: settings.minLotsToBuy,
      };
    }
    return {
      allowed: true,
      reason: settings.purchaseGate === 'nudge' && activeLotCount < settings.minLotsToBuy
        ? 'nudge'
        : undefined,
      activeLotCount,
      minLotsToBuy: settings.minLotsToBuy,
    };
  }

  async requestDeal(input: {
    communityId: string;
    buyerId: string;
    lotId: string;
    bankId: string;
  }): Promise<UzzDealDocument> {
    const gate = await this.canBuy(input.buyerId, input.communityId);
    if (!gate.allowed) {
      throw new ForbiddenException('Purchase gate blocked: create more lots first');
    }

    const lot = await this.lotModel.findOne({ id: input.lotId }).exec();
    if (!lot || !lot.active || lot.communityId !== input.communityId) {
      throw new NotFoundException('Lot not found');
    }
    if (await this.isSameLinkedActor(lot.authorId, input.buyerId)) {
      throw new BadRequestException('Cannot buy your own lot');
    }

    const bank = await this.requireBank(input.bankId);
    if (bank.communityId !== input.communityId) {
      throw new BadRequestException('Bank community mismatch');
    }
    if (!(await this.isSameLinkedActor(bank.ownerId, input.buyerId))) {
      throw new ForbiddenException('Only bank owner can spend the bank');
    }
    if (bank.status !== 'active') {
      throw new BadRequestException('Bank is not active');
    }
    if (bank.nominalRub == null || lot.priceRub > bank.nominalRub) {
      throw new BadRequestException('Lot price exceeds bank nominal');
    }

    const walletUserId = await this.pickWalletUserId(input.buyerId, input.communityId);
    const wallet = await this.walletService.getWallet(walletUserId, input.communityId);
    const balance = wallet?.getBalance?.() ?? 0;
    if (balance < DEAL_FEE_MERITS) {
      throw new BadRequestException('Insufficient wallet balance (need 1 заслуга)');
    }

    const openDeal = await this.dealModel
      .findOne({
        bankId: bank.id,
        status: { $in: ['requested', 'accepted', 'completed_by_seller'] },
      })
      .exec();
    if (openDeal) {
      throw new BadRequestException('Bank already has an open deal');
    }

    const now = new Date();
    const deal = await this.dealModel.create({
      id: uid(),
      communityId: input.communityId,
      buyerId: input.buyerId,
      sellerId: lot.authorId,
      lotId: lot.id,
      bankId: bank.id,
      status: 'requested' satisfies UzzDealStatus,
      dealAmountRub: null,
      requestedAt: now,
    });

    await this.appendLedger(
      input.communityId,
      'deal_requested',
      { lotId: lot.id, bankId: bank.id },
      input.buyerId,
      bank.id,
      deal.id,
    );
    return deal;
  }

  async acceptDeal(dealId: string, sellerId: string): Promise<UzzDealDocument> {
    const deal = await this.requireDeal(dealId);
    if (!(await this.isSameLinkedActor(deal.sellerId, sellerId))) {
      throw new ForbiddenException('Only seller can accept');
    }
    if (deal.status !== 'requested') {
      throw new BadRequestException('Deal is not in requested status');
    }

    const settings = await this.getOrCreateSettings(deal.communityId);
    const bank = await this.requireBank(deal.bankId);
    if (bank.status !== 'active') {
      throw new BadRequestException('Bank is not active');
    }

    const now = new Date();
    deal.status = 'accepted';
    deal.acceptedAt = now;
    await deal.save();

    if (settings.bankTransferMode === 'escrow_until_close') {
      bank.status = 'in_deal';
      await bank.save();
    } else if (settings.bankTransferMode === 'on_accept_locked') {
      await this.transferBankOwnership(bank, deal.sellerId, 'accept_locked', deal.id);
      bank.status = 'in_deal';
      await bank.save();
    }

    await this.appendLedger(
      deal.communityId,
      'deal_accepted',
      { mode: settings.bankTransferMode },
      sellerId,
      bank.id,
      deal.id,
    );
    return deal;
  }

  async rejectDeal(dealId: string, sellerId: string): Promise<UzzDealDocument> {
    const deal = await this.requireDeal(dealId);
    if (!(await this.isSameLinkedActor(deal.sellerId, sellerId))) {
      throw new ForbiddenException('Only seller can reject');
    }
    if (deal.status !== 'requested') {
      throw new BadRequestException('Deal is not in requested status');
    }
    deal.status = 'rejected';
    deal.rejectedAt = new Date();
    await deal.save();
    await this.appendLedger(
      deal.communityId,
      'deal_rejected',
      {},
      sellerId,
      deal.bankId,
      deal.id,
    );
    return deal;
  }

  async completeDeal(dealId: string, sellerId: string): Promise<UzzDealDocument> {
    const deal = await this.requireDeal(dealId);
    if (!(await this.isSameLinkedActor(deal.sellerId, sellerId))) {
      throw new ForbiddenException('Only seller can mark complete');
    }
    if (deal.status !== 'accepted') {
      throw new BadRequestException('Deal is not accepted');
    }
    deal.status = 'completed_by_seller';
    deal.completedBySellerAt = new Date();
    await deal.save();
    await this.appendLedger(
      deal.communityId,
      'deal_completed_by_seller',
      {},
      sellerId,
      deal.bankId,
      deal.id,
    );
    return deal;
  }

  async closeDeal(
    dealId: string,
    actorUserId: string,
    opts?: { asAdmin?: boolean },
  ): Promise<UzzDealDocument> {
    const deal = await this.requireDeal(dealId);
    const isBuyer = await this.isSameLinkedActor(deal.buyerId, actorUserId);
    if (!isBuyer && !opts?.asAdmin) {
      throw new ForbiddenException('Only buyer or admin can close');
    }
    if (deal.status !== 'accepted' && deal.status !== 'completed_by_seller') {
      throw new BadRequestException('Deal cannot be closed in current status');
    }

    const settings = await this.getOrCreateSettings(deal.communityId);
    const bank = await this.requireBank(deal.bankId);
    if (bank.nominalRub == null) {
      throw new BadRequestException('Bank has no nominal');
    }

    const walletUserId = await this.pickWalletUserId(deal.buyerId, deal.communityId);
    const debited = await this.walletService.debitIfSufficient(
      walletUserId,
      deal.communityId,
      DEAL_FEE_MERITS,
      'uzz_deal_fee',
      deal.id,
      'UZZ deal fee',
    );
    if (!debited) {
      throw new BadRequestException('Insufficient wallet balance to close deal');
    }

    const now = new Date();
    deal.status = 'closed';
    deal.closedAt = now;
    deal.dealAmountRub = bank.nominalRub;
    await deal.save();

    if (settings.bankTransferMode !== 'on_accept_locked') {
      await this.transferBankOwnership(bank, deal.sellerId, 'deal_close', deal.id);
    } else if (bank.ownerId !== deal.sellerId) {
      await this.transferBankOwnership(bank, deal.sellerId, 'deal_close', deal.id);
    }

    bank.hopsLeft = Math.max(0, bank.hopsLeft - 1);
    bank.status = bank.hopsLeft === 0 ? 'exhausted' : 'active';
    await bank.save();

    await this.appendLedger(
      deal.communityId,
      'deal_closed',
      {
        dealAmountRub: deal.dealAmountRub,
        hopsLeft: bank.hopsLeft,
        fee: DEAL_FEE_MERITS,
      },
      actorUserId,
      bank.id,
      deal.id,
    );
    return deal;
  }

  async cancelDeal(
    dealId: string,
    actorUserId: string,
    opts?: { asAdmin?: boolean },
  ): Promise<UzzDealDocument> {
    const deal = await this.requireDeal(dealId);
    const canCancel =
      opts?.asAdmin ||
      (await this.isSameLinkedActor(deal.buyerId, actorUserId)) ||
      (await this.isSameLinkedActor(deal.sellerId, actorUserId));
    if (!canCancel) {
      throw new ForbiddenException('Not allowed to cancel deal');
    }
    if (
      deal.status === 'closed' ||
      deal.status === 'rejected' ||
      deal.status === 'cancelled'
    ) {
      throw new BadRequestException('Deal already terminal');
    }

    const bank = await this.requireBank(deal.bankId);
    deal.status = 'cancelled';
    deal.cancelledAt = new Date();
    await deal.save();

    if (bank.status === 'in_deal') {
      const settings = await this.getOrCreateSettings(deal.communityId);
      if (settings.bankTransferMode === 'on_accept_locked' && bank.ownerId === deal.sellerId) {
        await this.transferBankOwnership(bank, deal.buyerId, 'deal_cancel_return', deal.id);
      }
      bank.status = bank.hopsLeft === 0 ? 'exhausted' : 'active';
      await bank.save();
    }

    await this.appendLedger(
      deal.communityId,
      'deal_cancelled',
      {},
      actorUserId,
      bank.id,
      deal.id,
    );
    return deal;
  }

  async applyDemurrage(): Promise<{ updated: number }> {
    const banks = await this.bankModel
      .find({ status: { $in: ['active', 'in_deal'] }, nominalRub: { $ne: null } })
      .exec();
    let updated = 0;
    const now = new Date();

    for (const bank of banks) {
      const settings = await this.getOrCreateSettings(bank.communityId);
      if (bank.nominalRub == null) continue;

      const last = bank.lastDemurrageAt?.getTime() ?? bank.createdAt?.getTime?.() ?? 0;
      if (now.getTime() - last < 20 * 60 * 60 * 1000) {
        continue;
      }

      const next = Math.max(
        settings.nominalFloorRub,
        bank.nominalRub - settings.demurrageRubPerDay,
      );
      if (next === bank.nominalRub) {
        bank.lastDemurrageAt = now;
        await bank.save();
        continue;
      }

      const prev = bank.nominalRub;
      bank.nominalRub = next;
      bank.lastDemurrageAt = now;
      await bank.save();
      await this.appendLedger(
        bank.communityId,
        'demurrage',
        { from: prev, to: next, demurrageRubPerDay: settings.demurrageRubPerDay },
        bank.ownerId,
        bank.id,
      );
      updated += 1;
    }

    return { updated };
  }

  async startTelegramLink(userId: string): Promise<{ code: string; expiresAt: Date }> {
    const code = randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
    await this.identityModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          pendingTelegramCode: code,
          pendingTelegramExpiresAt: expiresAt,
        },
        $setOnInsert: { userId },
      },
      { upsert: true, new: true },
    );
    return { code, expiresAt };
  }

  async confirmTelegramLink(
    code: string,
    telegramUserId: string,
  ): Promise<UzzIdentityLinkDocument> {
    const link = await this.identityModel
      .findOne({ pendingTelegramCode: code })
      .exec();
    if (!link || !link.pendingTelegramExpiresAt || link.pendingTelegramExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired Telegram link code');
    }
    const taken = await this.identityModel
      .findOne({
        telegramUserId: String(telegramUserId),
        userId: { $ne: link.userId },
      })
      .lean()
      .exec();
    if (taken) {
      throw new BadRequestException('Этот Telegram уже привязан к другому аккаунту');
    }
    link.telegramUserId = String(telegramUserId);
    link.pendingTelegramCode = undefined;
    link.pendingTelegramExpiresAt = undefined;
    await link.save();
    try {
      await this.userService.linkIdentity(link.userId, 'telegram', String(telegramUserId));
    } catch {
      // May already exist on the TG-provisioned user; UZZ link table is source of truth for pilot.
    }
    await this.promoteHoldingBanksIfLinked(link.userId);
    return link;
  }

  async startEmailLinkFromBot(
    userId: string,
    email: string,
  ): Promise<{ code: string; expiresAt: Date; email: string }> {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) {
      throw new BadRequestException('Invalid email');
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
    await this.identityModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          pendingEmail: normalized,
          pendingEmailCode: code,
          pendingEmailExpiresAt: expiresAt,
        },
        $setOnInsert: { userId },
      },
      { upsert: true, new: true },
    );
    // Caller (bot) delivers the code via DM and/or email.
    return { code, expiresAt, email: normalized };
  }

  async startEmailLinkByTelegram(
    telegramUserId: string,
    email: string,
  ): Promise<{ code: string; expiresAt: Date; email: string }> {
    const user = await this.userService.getUserByAuthId(
      'telegram',
      String(telegramUserId),
    );
    if (!user) {
      throw new BadRequestException('Сначала напишите боту /start в группе сообщества');
    }
    return this.startEmailLinkFromBot(user.id, email);
  }

  async confirmEmailLinkByTelegram(
    telegramUserId: string,
    code: string,
  ): Promise<UzzIdentityLinkDocument> {
    const user = await this.userService.getUserByAuthId(
      'telegram',
      String(telegramUserId),
    );
    if (!user) {
      throw new BadRequestException('Пользователь Telegram не найден');
    }
    const link = await this.confirmEmailLink(user.id, code);
    await this.identityModel.findOneAndUpdate(
      { userId: user.id },
      { $set: { telegramUserId: String(telegramUserId) } },
      { upsert: true },
    );
    await this.promoteHoldingBanksIfLinked(user.id);
    return link;
  }

  /** Dev/test helper: peek pending email code (not for production UI). */
  async getPendingEmailCodeForTests(userId: string): Promise<string | undefined> {
    const link = await this.identityModel.findOne({ userId }).lean().exec();
    return link?.pendingEmailCode;
  }

  async confirmEmailLink(userId: string, code: string): Promise<UzzIdentityLinkDocument> {
    const link = await this.identityModel.findOne({ userId }).exec();
    if (
      !link ||
      !link.pendingEmailCode ||
      link.pendingEmailCode !== code ||
      !link.pendingEmailExpiresAt ||
      link.pendingEmailExpiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired email link code');
    }
    link.email = link.pendingEmail;
    link.pendingEmail = undefined;
    link.pendingEmailCode = undefined;
    link.pendingEmailExpiresAt = undefined;
    await link.save();
    if (link.email) {
      try {
        await this.userService.linkIdentity(userId, 'email', link.email);
      } catch {
        // Identity may already exist; ignore for MVP link table.
      }
    }
    await this.promoteHoldingBanksIfLinked(userId);
    return link;
  }

  async getLinkStatus(userId: string): Promise<{
    linked: boolean;
    telegramUserId?: string;
    email?: string;
  }> {
    const link = await this.findIdentityLinkForUser(userId);
    const telegramUserId = link?.telegramUserId;
    const email = link?.email;
    return {
      linked: Boolean(telegramUserId && email),
      telegramUserId,
      email,
    };
  }

  async listLedger(
    communityId: string,
    opts?: { limit?: number; skip?: number },
  ): Promise<UzzLedgerDocument[]> {
    const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
    const skip = Math.max(0, opts?.skip ?? 0);
    return this.ledgerModel
      .find({ communityId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async listDeals(
    communityId: string,
    userId?: string,
  ): Promise<UzzDealDocument[]> {
    const filter: Record<string, unknown> = { communityId };
    if (userId) {
      const ids = await this.resolveLinkedUserIds(userId);
      filter.$or = [{ buyerId: { $in: ids } }, { sellerId: { $in: ids } }];
    }
    return this.dealModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async listDeeds(
    userId: string,
    communityId: string,
  ): Promise<
    Array<{
      publicationId: string;
      title?: string;
      score: number;
      emissionThreshold: number;
      progress: number;
      bankStatus?: UzzBankStatus;
    }>
  > {
    const settings = await this.getOrCreateSettings(communityId);
    const authorIds = await this.resolveLinkedUserIds(userId);
    const pubs = await this.publicationModel
      .find({
        authorId: { $in: authorIds },
        communityId,
        deleted: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();

    const pubIds = pubs.map((p) => p.id);
    const banks = await this.bankModel
      .find({ sourcePublicationId: { $in: pubIds } })
      .lean()
      .exec();
    const byPub = new Map(banks.map((b) => [b.sourcePublicationId, b]));

    return pubs.map((p) => {
      const score = p.metrics?.score ?? 0;
      const bank = byPub.get(p.id);
      return {
        publicationId: p.id,
        title: p.title,
        score,
        emissionThreshold: settings.emissionThreshold,
        progress: Math.min(1, score / Math.max(1, settings.emissionThreshold)),
        bankStatus: bank?.status,
      };
    });
  }

  async getBankById(bankId: string): Promise<UzzBankDocument> {
    return this.requireBank(bankId);
  }

  async getSpendableBalance(userId: string, communityId: string): Promise<number> {
    const walletUserId = await this.pickWalletUserId(userId, communityId);
    const wallet = await this.walletService.getWallet(walletUserId, communityId);
    return wallet?.getBalance?.() ?? 0;
  }

  async assertCommunityAdmin(communityId: string, userId: string): Promise<void> {
    const user = await this.userService.getUserById(userId);
    if (user?.globalRole === 'superadmin') return;
    const isAdmin = await this.communityService.isUserAdmin(communityId, userId);
    if (!isAdmin) {
      throw new ForbiddenException('Lead or superadmin required');
    }
  }

  private async hasFullIdentityLink(userId: string): Promise<boolean> {
    const status = await this.getLinkStatus(userId);
    return status.linked;
  }

  private async findIdentityLinkForUser(
    userId: string,
  ): Promise<{ userId: string; telegramUserId?: string; email?: string } | null> {
    const direct = await this.identityModel.findOne({ userId }).lean().exec();
    if (direct) return direct;
    const user = await this.userService.getUserById(userId);
    if (user?.authProvider === 'telegram' && user.authId) {
      return this.identityModel
        .findOne({ telegramUserId: String(user.authId) })
        .lean()
        .exec();
    }
    return null;
  }

  /** Email-session user and Telegram-provisioned user must both see shared UZZ assets. */
  private async resolveLinkedUserIds(userId: string): Promise<string[]> {
    const ids = new Set<string>([userId]);
    const link = await this.findIdentityLinkForUser(userId);
    if (link?.userId) ids.add(link.userId);
    if (link?.telegramUserId) {
      const tgUser = await this.userService.getUserByAuthId(
        'telegram',
        String(link.telegramUserId),
      );
      if (tgUser?.id) ids.add(tgUser.id);
    }
    return [...ids];
  }

  private async isSameLinkedActor(a: string, b: string): Promise<boolean> {
    if (a === b) return true;
    const ids = await this.resolveLinkedUserIds(a);
    return ids.includes(b);
  }

  /** Prefer the linked identity that actually holds wallet balance (usually TG user). */
  private async pickWalletUserId(userId: string, communityId: string): Promise<string> {
    const ids = await this.resolveLinkedUserIds(userId);
    let bestId = userId;
    let bestBalance = -1;
    for (const id of ids) {
      const wallet = await this.walletService.getWallet(id, communityId);
      const balance = wallet?.getBalance?.() ?? 0;
      if (balance > bestBalance) {
        bestBalance = balance;
        bestId = id;
      }
    }
    return bestId;
  }

  private async promoteHoldingBanksIfLinked(userId: string): Promise<void> {
    if (!(await this.hasFullIdentityLink(userId))) return;
    const ownerIds = await this.resolveLinkedUserIds(userId);
    await this.bankModel.updateMany(
      { ownerId: { $in: ownerIds }, status: 'holding' },
      { $set: { status: 'awaiting_nominal' } },
    );
  }

  private async transferBankOwnership(
    bank: UzzBankDocument,
    newOwnerId: string,
    reason: string,
    dealId?: string,
  ): Promise<void> {
    bank.ownerId = newOwnerId;
    bank.ownerHistory = [
      ...(bank.ownerHistory ?? []),
      { userId: newOwnerId, at: new Date(), reason },
    ];
    await bank.save();
    await this.appendLedger(
      bank.communityId,
      'bank_transferred',
      { reason, dealId },
      newOwnerId,
      bank.id,
      dealId,
    );
  }

  private async requireBank(bankId: string): Promise<UzzBankDocument> {
    const bank = await this.bankModel.findOne({ id: bankId }).exec();
    if (!bank) throw new NotFoundException('Bank not found');
    return bank;
  }

  private async requireDeal(dealId: string): Promise<UzzDealDocument> {
    const deal = await this.dealModel.findOne({ id: dealId }).exec();
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  private async appendLedger(
    communityId: string,
    type: string,
    payload: Record<string, unknown>,
    userId?: string,
    bankId?: string,
    dealId?: string,
  ): Promise<void> {
    await this.ledgerModel.create({
      id: uid(),
      communityId,
      type,
      payload,
      userId,
      bankId,
      dealId,
    });
  }
}
