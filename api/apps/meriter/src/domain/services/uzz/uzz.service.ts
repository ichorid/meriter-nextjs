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
import { MeritResolverService } from '../merit-resolver.service';
import { EventBus } from '../../events/event-bus';
import { UzzNotifyEvent } from '../../events/uzz.events';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration';

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
const OPEN_DEAL_STATUSES: UzzDealStatus[] = [
  'requested',
  'accepted',
  'completed_by_seller',
];
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CURRENCY = {
  singular: 'заслуга',
  plural: 'заслуги',
  genitive: 'заслуг',
} as const;

function isMongoDuplicateKey(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: number }).code === 11000,
  );
}

export type UzzBankView = {
  id: string;
  communityId: string;
  ownerId: string;
  sourcePublicationId: string;
  hopsLeft: number;
  nominalRub: number | null;
  status: UzzBankStatus;
  lastDemurrageAt?: Date;
  createdAt: Date;
  ownerName: string;
};

export type UzzLotView = {
  id: string;
  communityId: string;
  authorId: string;
  title: string;
  description: string;
  priceRub: number;
  active: boolean;
  createdAt: Date;
  ownerName: string;
};

export type UzzDealView = {
  id: string;
  communityId: string;
  buyerId: string;
  sellerId: string;
  lotId: string;
  bankId: string;
  status: UzzDealStatus;
  dealAmountRub: number | null;
  feeReserved: boolean;
  requestedAt: Date;
  acceptedAt?: Date;
  completedBySellerAt?: Date;
  closedAt?: Date;
  rejectedAt?: Date;
  cancelledAt?: Date;
  buyerThankedAt?: Date;
  sellerThankedAt?: Date;
  lotTitle: string;
  lotPriceRub: number | null;
  counterpartyName: string;
  myRole: 'buyer' | 'seller' | 'other';
  expiresAt: Date | null;
  createdAt: Date;
};

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
    private readonly meritResolver: MeritResolverService,
    private readonly eventBus: EventBus,
    private readonly configService: ConfigService<AppConfig>,
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

    const uzzCommunity =
      this.configService.get('app')?.defaultTelegramCommunityId?.trim() || '';
    if (uzzCommunity && publication.communityId !== uzzCommunity) {
      return null;
    }

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
    await this.notifyUser(
      publication.authorId,
      publication.communityId,
      'bankEmitted',
      linked
        ? 'Появилось право на обмен. Администратор скоро назначит номинал в рублях.'
        : 'Появилось право на обмен, но нужна привязка Telegram и почты, чтобы им пользоваться.',
      '/',
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
    bank.lastDemurrageAt = new Date();
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

  async listMyBanks(userId: string, communityId: string): Promise<UzzBankView[]> {
    const ownerIds = await this.resolveLinkedUserIds(userId);
    const banks = await this.bankModel
      .find({ ownerId: { $in: ownerIds }, communityId })
      .sort({ createdAt: -1 })
      .exec();
    return this.toBankViews(banks);
  }

  async adminListAwaitingNominal(communityId: string): Promise<UzzBankView[]> {
    const banks = await this.bankModel
      .find({ communityId, status: 'awaiting_nominal' })
      .sort({ createdAt: 1 })
      .exec();
    return this.toBankViews(banks);
  }

  async adminListHolding(communityId: string): Promise<UzzBankView[]> {
    const banks = await this.bankModel
      .find({ communityId, status: 'holding' })
      .sort({ createdAt: 1 })
      .exec();
    return this.toBankViews(banks);
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

  async listLots(communityId: string): Promise<UzzLotView[]> {
    const lots = await this.lotModel
      .find({ communityId, active: true })
      .sort({ createdAt: -1 })
      .exec();
    return this.toLotViews(lots);
  }

  async myLots(userId: string, communityId: string): Promise<UzzLotView[]> {
    const authorIds = await this.resolveLinkedUserIds(userId);
    const lots = await this.lotModel
      .find({ authorId: { $in: authorIds }, communityId })
      .sort({ createdAt: -1 })
      .exec();
    return this.toLotViews(lots);
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
      throw new ForbiddenException(
        'Сначала опубликуйте свои услуги, чтобы запрашивать чужие',
      );
    }

    if (
      !this.configService.get('dev')?.fakeDataMode &&
      !(await this.hasFullIdentityLink(input.buyerId))
    ) {
      throw new ForbiddenException(
        'Сначала привяжите Telegram и почту в профиле',
      );
    }

    const lot = await this.lotModel.findOne({ id: input.lotId }).exec();
    if (!lot || !lot.active || lot.communityId !== input.communityId) {
      throw new NotFoundException('Lot not found');
    }
    if (await this.isSameLinkedActor(lot.authorId, input.buyerId)) {
      throw new BadRequestException('Нельзя запросить свою услугу');
    }

    const bank = await this.requireBank(input.bankId);
    if (bank.communityId !== input.communityId) {
      throw new BadRequestException('Право на обмен из другого сообщества');
    }
    if (!(await this.isSameLinkedActor(bank.ownerId, input.buyerId))) {
      throw new ForbiddenException('Этим правом можете распоряжаться только вы');
    }
    if (bank.status !== 'active') {
      throw new BadRequestException('Право сейчас нельзя обменять');
    }
    if (bank.nominalRub == null || lot.priceRub > bank.nominalRub) {
      throw new BadRequestException('Цена выше сегодняшнего номинала');
    }

    const openDeal = await this.dealModel
      .findOne({
        bankId: bank.id,
        status: { $in: OPEN_DEAL_STATUSES },
      })
      .exec();
    if (openDeal) {
      throw new BadRequestException('Это право уже в сделке');
    }

    const walletUserId = await this.pickWalletUserId(input.buyerId, input.communityId);
    const walletCommunityId = await this.walletScope(input.communityId);
    const reserved = await this.walletService.debitIfSufficient(
      walletUserId,
      walletCommunityId,
      DEAL_FEE_MERITS,
      'uzz_deal_fee',
      input.bankId,
      'UZZ deal fee reserved',
    );
    if (!reserved) {
      throw new BadRequestException('Не хватает 1 заслуги на комиссию');
    }

    const now = new Date();
    let deal;
    try {
      deal = await this.dealModel.create({
        id: uid(),
        communityId: input.communityId,
        buyerId: input.buyerId,
        sellerId: lot.authorId,
        lotId: lot.id,
        bankId: bank.id,
        status: 'requested' satisfies UzzDealStatus,
        dealAmountRub: null,
        feeReserved: true,
        requestedAt: now,
      });
    } catch (error) {
      await this.creditDealFee(walletUserId, input.communityId, input.bankId);
      if (isMongoDuplicateKey(error)) {
        throw new BadRequestException('Это право уже в сделке');
      }
      throw error;
    }

    await this.appendLedger(
      input.communityId,
      'deal_fee_reserved',
      { amount: DEAL_FEE_MERITS },
      input.buyerId,
      bank.id,
      deal.id,
    );
    await this.appendLedger(
      input.communityId,
      'deal_requested',
      { lotId: lot.id, bankId: bank.id },
      input.buyerId,
      bank.id,
      deal.id,
    );
    const settings = await this.getOrCreateSettings(input.communityId);
    await this.notifyUser(
      lot.authorId,
      input.communityId,
      'dealRequested',
      `Новый запрос на услугу «${lot.title}». Ответьте в течение ${settings.dealRequestTtlHours} ч.`,
      '/deals',
    );
    return deal;
  }

  async acceptDeal(dealId: string, sellerId: string): Promise<UzzDealDocument> {
    const deal = await this.requireDeal(dealId);
    if (!(await this.isSameLinkedActor(deal.sellerId, sellerId))) {
      throw new ForbiddenException('Принять заявку может только исполнитель');
    }
    if (deal.status !== 'requested') {
      throw new BadRequestException('Заявка уже не ждёт ответа');
    }

    const settings = await this.getOrCreateSettings(deal.communityId);
    const bank = await this.requireBank(deal.bankId);
    if (settings.bankTransferMode !== 'on_close_only') {
      const locked = await this.bankModel.findOneAndUpdate(
        { id: bank.id, status: 'active' },
        { $set: { status: 'in_deal' } },
        { new: true },
      );
      if (!locked) {
        throw new BadRequestException('Право уже занято другой сделкой');
      }
    }

    const now = new Date();
    deal.status = 'accepted';
    deal.acceptedAt = now;
    try {
      await deal.save();
    } catch (error) {
      if (settings.bankTransferMode !== 'on_close_only') {
        await this.bankModel.updateOne(
          { id: bank.id, status: 'in_deal' },
          { $set: { status: 'active' } },
        );
      }
      throw error;
    }

    if (settings.bankTransferMode === 'on_accept_locked') {
      const lockedBank = await this.requireBank(deal.bankId);
      await this.transferBankOwnership(
        lockedBank,
        deal.sellerId,
        'accept_locked',
        deal.id,
      );
      lockedBank.status = 'in_deal';
      await lockedBank.save();
    }

    await this.appendLedger(
      deal.communityId,
      'deal_accepted',
      { mode: settings.bankTransferMode },
      sellerId,
      bank.id,
      deal.id,
    );
    await this.notifyUser(
      deal.buyerId,
      deal.communityId,
      'dealAccepted',
      'Исполнитель принял вашу заявку. Дождитесь отметки «сделано».',
      '/deals',
    );
    return deal;
  }

  async rejectDeal(dealId: string, sellerId: string): Promise<UzzDealDocument> {
    const deal = await this.requireDeal(dealId);
    if (!(await this.isSameLinkedActor(deal.sellerId, sellerId))) {
      throw new ForbiddenException('Отклонить заявку может только исполнитель');
    }
    if (deal.status !== 'requested') {
      throw new BadRequestException('Заявка уже не ждёт ответа');
    }
    deal.status = 'rejected';
    deal.rejectedAt = new Date();
    await deal.save();
    await this.refundDealFeeIfReserved(deal);
    await this.appendLedger(
      deal.communityId,
      'deal_rejected',
      {},
      sellerId,
      deal.bankId,
      deal.id,
    );
    await this.notifyUser(
      deal.buyerId,
      deal.communityId,
      'dealRequested',
      'Исполнитель отклонил заявку. Комиссия возвращена, право на обмен снова у вас.',
      '/deals',
    );
    return deal;
  }

  async completeDeal(dealId: string, sellerId: string): Promise<UzzDealDocument> {
    const deal = await this.requireDeal(dealId);
    if (!(await this.isSameLinkedActor(deal.sellerId, sellerId))) {
      throw new ForbiddenException('Отметить «сделано» может только исполнитель');
    }
    if (deal.status !== 'accepted') {
      throw new BadRequestException('Сначала примите заявку');
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
    await this.notifyUser(
      deal.buyerId,
      deal.communityId,
      'dealAccepted',
      'Исполнитель отметил услугу как сделанную. Подтвердите закрытие на площадке.',
      '/deals',
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
      throw new ForbiddenException('Закрыть сделку может заказчик или администратор');
    }
    if (!opts?.asAdmin && deal.status !== 'completed_by_seller') {
      throw new BadRequestException('Дождитесь отметки «сделано»');
    }
    if (deal.status !== 'accepted' && deal.status !== 'completed_by_seller') {
      throw new BadRequestException('Эту сделку уже нельзя закрыть');
    }

    const settings = await this.getOrCreateSettings(deal.communityId);
    const bank = await this.requireBank(deal.bankId);
    if (bank.nominalRub == null) {
      throw new BadRequestException('У права ещё нет номинала');
    }

    if (!deal.feeReserved) {
      const walletUserId = await this.pickWalletUserId(deal.buyerId, deal.communityId);
      const walletCommunityId = await this.walletScope(deal.communityId);
      const debited = await this.walletService.debitIfSufficient(
        walletUserId,
        walletCommunityId,
        DEAL_FEE_MERITS,
        'uzz_deal_fee',
        deal.id,
        'UZZ deal fee',
      );
      if (!debited) {
        throw new BadRequestException('Не хватает заслуг, чтобы закрыть сделку');
      }
      deal.feeReserved = true;
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
    bank.status = this.statusAfterBankReleased(bank, settings);
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
    await this.notifyUser(
      deal.sellerId,
      deal.communityId,
      'dealClosed',
      'Сделка закрыта. Право на обмен перешло к вам.',
      '/deals',
    );
    await this.notifyUser(
      deal.buyerId,
      deal.communityId,
      'dealClosed',
      'Сделка закрыта. Можно оставить благодарность на площадке.',
      '/deals',
    );
    return deal;
  }

  async cancelDeal(
    dealId: string,
    actorUserId: string,
    opts?: { asAdmin?: boolean },
  ): Promise<UzzDealDocument> {
    const deal = await this.requireDeal(dealId);
    const isBuyer = await this.isSameLinkedActor(deal.buyerId, actorUserId);
    const isSeller = await this.isSameLinkedActor(deal.sellerId, actorUserId);
    const canCancel = Boolean(opts?.asAdmin || isBuyer || isSeller);
    if (!canCancel) {
      throw new ForbiddenException('Нельзя отменить чужую сделку');
    }
    if (
      deal.status === 'closed' ||
      deal.status === 'rejected' ||
      deal.status === 'cancelled'
    ) {
      throw new BadRequestException('Сделка уже завершена');
    }
    if (!opts?.asAdmin) {
      if (deal.status !== 'requested') {
        throw new BadRequestException(
          'После ответа исполнителя отменить может только администратор',
        );
      }
      if (!isBuyer) {
        throw new ForbiddenException('Заявку отменяет заказчик, исполнитель — отклоняет');
      }
    }

    const bank = await this.requireBank(deal.bankId);
    deal.status = 'cancelled';
    deal.cancelledAt = new Date();
    await deal.save();
    await this.refundDealFeeIfReserved(deal);

    if (bank.status === 'in_deal') {
      const settings = await this.getOrCreateSettings(deal.communityId);
      const otherOpen = await this.dealModel
        .findOne({
          bankId: bank.id,
          id: { $ne: deal.id },
          status: { $in: OPEN_DEAL_STATUSES },
        })
        .exec();
      if (!otherOpen) {
        if (settings.bankTransferMode === 'on_accept_locked' && bank.ownerId === deal.sellerId) {
          await this.transferBankOwnership(bank, deal.buyerId, 'deal_cancel_return', deal.id);
        }
        bank.status = this.statusAfterBankReleased(bank, settings);
        await bank.save();
      }
    }

    await this.appendLedger(
      deal.communityId,
      'deal_cancelled',
      {},
      actorUserId,
      bank.id,
      deal.id,
    );
    await this.notifyUser(
      deal.buyerId,
      deal.communityId,
      'dealRequested',
      'Сделка отменена. Комиссия возвращена, право на обмен снова свободно.',
      '/deals',
    );
    await this.notifyUser(
      deal.sellerId,
      deal.communityId,
      'dealRequested',
      'Сделка отменена.',
      '/deals',
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

      const last = bank.lastDemurrageAt?.getTime();
      if (last == null) {
        bank.lastDemurrageAt = now;
        await bank.save();
        continue;
      }
      const days = Math.floor((now.getTime() - last) / DAY_MS);
      if (days < 1) {
        continue;
      }

      const next = Math.max(
        settings.nominalFloorRub,
        bank.nominalRub - settings.demurrageRubPerDay * days,
      );
      if (next === bank.nominalRub) {
        if (next <= settings.nominalFloorRub && bank.status === 'active') {
          bank.status = 'exhausted';
          bank.lastDemurrageAt = now;
          await bank.save();
          await this.appendLedger(
            bank.communityId,
            'bank_exhausted',
            { reason: 'nominal_floor', nominalRub: next },
            bank.ownerId,
            bank.id,
          );
          updated += 1;
        } else {
          bank.lastDemurrageAt = now;
          await bank.save();
        }
        continue;
      }

      const prev = bank.nominalRub;
      bank.nominalRub = next;
      bank.lastDemurrageAt = now;
      if (next <= settings.nominalFloorRub && bank.status === 'active') {
        bank.status = 'exhausted';
      }
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

  async expireStaleDeals(): Promise<{ expired: number }> {
    const now = Date.now();
    const open = await this.dealModel
      .find({ status: { $in: ['requested', 'accepted', 'completed_by_seller'] } })
      .exec();
    let expired = 0;
    for (const deal of open) {
      const settings = await this.getOrCreateSettings(deal.communityId);
      const requestTtlMs = settings.dealRequestTtlHours * 60 * 60 * 1000;
      const fulfillMs = settings.dealFulfillmentDays * 24 * 60 * 60 * 1000;
      let stale = false;
      if (deal.status === 'requested') {
        stale = now - deal.requestedAt.getTime() > requestTtlMs;
      } else {
        const from = deal.acceptedAt?.getTime() ?? deal.requestedAt.getTime();
        stale = now - from > fulfillMs;
      }
      if (!stale) continue;
      try {
        await this.cancelDeal(deal.id, 'system', { asAdmin: true });
        expired += 1;
      } catch {
        // already terminal or race
      }
    }
    return { expired };
  }

  async thankDeal(
    dealId: string,
    actorUserId: string,
    input: { comment?: string; merits?: number },
  ): Promise<UzzDealDocument> {
    const deal = await this.requireDeal(dealId);
    if (deal.status !== 'closed') {
      throw new BadRequestException('Благодарность — только после закрытия сделки');
    }
    const isBuyer = await this.isSameLinkedActor(deal.buyerId, actorUserId);
    const isSeller = await this.isSameLinkedActor(deal.sellerId, actorUserId);
    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('Благодарить могут только стороны сделки');
    }

    const merits = Math.max(0, Math.round(input.merits ?? 0));
    const comment = (input.comment ?? '').trim();
    if (!comment && merits <= 0) {
      throw new BadRequestException('Напишите пару слов или отправьте хотя бы 1 заслугу');
    }

    const now = new Date();
    const claimed = isBuyer
      ? await this.dealModel.findOneAndUpdate(
          {
            id: deal.id,
            $or: [{ buyerThankedAt: { $exists: false } }, { buyerThankedAt: null }],
          },
          {
            $set: {
              buyerThankedAt: now,
              buyerThanksComment: comment || undefined,
              buyerThanksMerits: merits,
            },
          },
          { new: true },
        )
      : await this.dealModel.findOneAndUpdate(
          {
            id: deal.id,
            $or: [{ sellerThankedAt: { $exists: false } }, { sellerThankedAt: null }],
          },
          {
            $set: {
              sellerThankedAt: now,
              sellerThanksComment: comment || undefined,
              sellerThanksMerits: merits,
            },
          },
          { new: true },
        );
    if (!claimed) {
      throw new BadRequestException('Вы уже отправили благодарность');
    }

    if (merits > 0) {
      const payerId = await this.pickWalletUserId(actorUserId, deal.communityId);
      const payeeId = await this.pickWalletUserId(
        isBuyer ? deal.sellerId : deal.buyerId,
        deal.communityId,
      );
      const walletCommunityId = await this.walletScope(deal.communityId);
      const currency = await this.communityCurrency(deal.communityId);
      const debited = await this.walletService.debitIfSufficient(
        payerId,
        walletCommunityId,
        merits,
        'uzz_thanks',
        deal.id,
        'UZZ thanks',
      );
      if (!debited) {
        if (isBuyer) {
          claimed.buyerThankedAt = undefined;
          claimed.buyerThanksComment = undefined;
          claimed.buyerThanksMerits = undefined;
        } else {
          claimed.sellerThankedAt = undefined;
          claimed.sellerThanksComment = undefined;
          claimed.sellerThanksMerits = undefined;
        }
        await claimed.save();
        throw new BadRequestException('Не хватает заслуг для благодарности');
      }
      await this.walletService.createOrGetWallet(payeeId, walletCommunityId, currency);
      await this.walletService.addTransaction(
        payeeId,
        walletCommunityId,
        'credit',
        merits,
        'personal',
        'uzz_thanks',
        deal.id,
        currency,
        'UZZ thanks',
      );
    }

    await this.appendLedger(
      deal.communityId,
      'deal_thanks',
      { comment, merits, fromBuyer: isBuyer },
      actorUserId,
      deal.bankId,
      deal.id,
    );
    return claimed;
  }

  async bootstrap(userId: string): Promise<{
    communityId: string;
    communityName: string | null;
    isUzzAdmin: boolean;
  }> {
    const memberships = await this.communityService.getUserCommunities(userId);
    const withTg = memberships.filter((c) => Boolean(c.telegramChatId));
    const fallback =
      this.configService.get('app')?.defaultTelegramCommunityId?.trim() || '';
    const resolved =
      withTg.length === 1
        ? withTg[0]
        : withTg.find((c) => c.id === fallback) ??
          memberships.find((c) => c.id === fallback);
    const communityId = resolved?.id ?? fallback;
    let communityName = resolved?.name ?? null;
    if (!communityName && communityId) {
      const community = await this.communityService.getCommunity(communityId);
      communityName = community?.name ?? null;
    }
    let isUzzAdmin = false;
    if (communityId) {
      try {
        await this.assertCommunityAdmin(communityId, userId);
        isUzzAdmin = true;
      } catch {
        isUzzAdmin = false;
      }
    }
    return { communityId, communityName, isUzzAdmin };
  }

  async listLedgerMine(
    userId: string,
    communityId: string,
    opts?: { limit?: number; skip?: number },
  ): Promise<UzzLedgerDocument[]> {
    const ids = await this.resolveLinkedUserIds(userId);
    const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
    const skip = Math.max(0, opts?.skip ?? 0);
    return this.ledgerModel
      .find({ communityId, userId: { $in: ids } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
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
  ): Promise<UzzDealView[]> {
    const filter: Record<string, unknown> = { communityId };
    if (userId) {
      const ids = await this.resolveLinkedUserIds(userId);
      filter.$or = [{ buyerId: { $in: ids } }, { sellerId: { $in: ids } }];
    }
    const deals = await this.dealModel.find(filter).sort({ createdAt: -1 }).exec();
    return this.toDealViews(deals, userId);
  }

  async listOpenDeals(communityId: string): Promise<UzzDealView[]> {
    const deals = await this.dealModel
      .find({ communityId, status: { $in: OPEN_DEAL_STATUSES } })
      .sort({ createdAt: -1 })
      .exec();
    return this.toDealViews(deals);
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

  async assertCanTriggerEmission(publicationId: string, userId: string): Promise<void> {
    const publication = await this.publicationModel.findOne({ id: publicationId }).exec();
    if (!publication) {
      throw new NotFoundException('Публикация не найдена');
    }
    if (await this.isSameLinkedActor(publication.authorId, userId)) return;
    await this.assertCommunityAdmin(publication.communityId, userId);
  }

  async adminCloseDeal(dealId: string, adminUserId: string): Promise<UzzDealDocument> {
    const deal = await this.requireDeal(dealId);
    await this.assertCommunityAdmin(deal.communityId, adminUserId);
    return this.closeDeal(dealId, adminUserId, { asAdmin: true });
  }

  async adminCancelDeal(dealId: string, adminUserId: string): Promise<UzzDealDocument> {
    const deal = await this.requireDeal(dealId);
    await this.assertCommunityAdmin(deal.communityId, adminUserId);
    return this.cancelDeal(dealId, adminUserId, { asAdmin: true });
  }

  async getBankById(bankId: string): Promise<UzzBankDocument> {
    return this.requireBank(bankId);
  }

  async getSpendableBalance(userId: string, communityId: string): Promise<number> {
    const walletUserId = await this.pickWalletUserId(userId, communityId);
    const walletCommunityId = await this.walletScope(communityId);
    const wallet = await this.walletService.getWallet(walletUserId, walletCommunityId);
    return wallet?.getBalance?.() ?? 0;
  }

  async assertCommunityAdmin(communityId: string, userId: string): Promise<void> {
    const user = await this.userService.getUserById(userId);
    if (user?.globalRole === 'superadmin') return;
    const isAdmin = await this.communityService.isUserAdmin(communityId, userId);
    if (!isAdmin) {
      throw new ForbiddenException('Нужна роль администратора сообщества');
    }
  }

  private async communityCurrency(communityId: string): Promise<{
    singular: string;
    plural: string;
    genitive: string;
  }> {
    const community = await this.communityService.getCommunity(communityId);
    const names = community?.settings?.currencyNames;
    if (names?.singular && names?.plural && names?.genitive) {
      return {
        singular: names.singular,
        plural: names.plural,
        genitive: names.genitive,
      };
    }
    return { ...DEFAULT_CURRENCY };
  }

  private async creditDealFee(
    walletUserId: string,
    communityId: string,
    referenceId: string,
  ): Promise<void> {
    const currency = await this.communityCurrency(communityId);
    const walletCommunityId = await this.walletScope(communityId);
    await this.walletService.addTransaction(
      walletUserId,
      walletCommunityId,
      'credit',
      DEAL_FEE_MERITS,
      'personal',
      'uzz_deal_fee_refund',
      referenceId,
      currency,
      'UZZ deal fee refund',
    );
  }

  private async refundDealFeeIfReserved(deal: UzzDealDocument): Promise<void> {
    if (!deal.feeReserved) return;
    const walletUserId = await this.pickWalletUserId(deal.buyerId, deal.communityId);
    await this.creditDealFee(walletUserId, deal.communityId, deal.id);
    deal.feeReserved = false;
    await deal.save();
    await this.appendLedger(
      deal.communityId,
      'deal_fee_refunded',
      { amount: DEAL_FEE_MERITS },
      deal.buyerId,
      deal.bankId,
      deal.id,
    );
  }

  private async notifyUser(
    userId: string,
    communityId: string,
    flag: keyof UzzNotifyFlags,
    text: string,
    path = '',
  ): Promise<void> {
    try {
      const settings = await this.getOrCreateSettings(communityId);
      if (!settings.notifyFlags?.[flag]) return;
      const link = await this.findIdentityLinkForUser(userId);
      if (!link?.telegramUserId) return;
      const base = this.configService.get('app')?.uzzWebBaseUrl?.replace(/\/$/, '');
      const body = base ? `${text}\n${base}${path}` : text;
      await this.eventBus.publish(
        new UzzNotifyEvent(communityId, String(link.telegramUserId), body),
      );
    } catch {
      // notifications must not fail the business path
    }
  }

  private friendlyName(raw: string | undefined, userId: string): string {
    const name = (raw ?? '').trim();
    if (!name || name === userId || name.endsWith('…')) return 'Участник';
    return name;
  }

  private async toBankViews(banks: UzzBankDocument[]): Promise<UzzBankView[]> {
    const names = await this.userService.getDisplayNamesByUserIds(
      banks.map((b) => b.ownerId),
    );
    return banks.map((bank) => ({
      id: bank.id,
      communityId: bank.communityId,
      ownerId: bank.ownerId,
      sourcePublicationId: bank.sourcePublicationId,
      hopsLeft: bank.hopsLeft,
      nominalRub: bank.nominalRub,
      status: bank.status,
      lastDemurrageAt: bank.lastDemurrageAt,
      createdAt: bank.createdAt,
      ownerName: this.friendlyName(names.get(bank.ownerId), bank.ownerId),
    }));
  }

  private async toLotViews(lots: UzzLotDocument[]): Promise<UzzLotView[]> {
    const names = await this.userService.getDisplayNamesByUserIds(
      lots.map((l) => l.authorId),
    );
    return lots.map((lot) => ({
      id: lot.id,
      communityId: lot.communityId,
      authorId: lot.authorId,
      title: lot.title,
      description: lot.description,
      priceRub: lot.priceRub,
      active: lot.active,
      createdAt: lot.createdAt,
      ownerName: this.friendlyName(names.get(lot.authorId), lot.authorId),
    }));
  }

  private async toDealViews(
    deals: UzzDealDocument[],
    viewerUserId?: string,
  ): Promise<UzzDealView[]> {
    const lotIds = [...new Set(deals.map((d) => d.lotId))];
    const lots = await this.lotModel.find({ id: { $in: lotIds } }).lean().exec();
    const lotById = new Map(lots.map((l) => [l.id, l]));
    const userIds = deals.flatMap((d) => [d.buyerId, d.sellerId]);
    const names = await this.userService.getDisplayNamesByUserIds(userIds);
    const viewerIds = viewerUserId
      ? await this.resolveLinkedUserIds(viewerUserId)
      : [];
    const communityIds = [...new Set(deals.map((d) => d.communityId))];
    const settingsByCommunity = new Map(
      await Promise.all(
        communityIds.map(async (id) => [id, await this.getOrCreateSettings(id)] as const),
      ),
    );

    return deals.map((deal) => {
      const isBuyer = viewerIds.includes(deal.buyerId);
      const isSeller = viewerIds.includes(deal.sellerId);
      const counterpartyId = isBuyer ? deal.sellerId : deal.buyerId;
      let myRole: UzzDealView['myRole'] = 'other';
      if (isBuyer) myRole = 'buyer';
      else if (isSeller) myRole = 'seller';
      const settings = settingsByCommunity.get(deal.communityId);
      return {
        id: deal.id,
        communityId: deal.communityId,
        buyerId: deal.buyerId,
        sellerId: deal.sellerId,
        lotId: deal.lotId,
        bankId: deal.bankId,
        status: deal.status,
        dealAmountRub: deal.dealAmountRub,
        feeReserved: deal.feeReserved,
        requestedAt: deal.requestedAt,
        acceptedAt: deal.acceptedAt,
        completedBySellerAt: deal.completedBySellerAt,
        closedAt: deal.closedAt,
        rejectedAt: deal.rejectedAt,
        cancelledAt: deal.cancelledAt,
        buyerThankedAt: deal.buyerThankedAt,
        sellerThankedAt: deal.sellerThankedAt,
        lotTitle: lotById.get(deal.lotId)?.title ?? 'Услуга',
        lotPriceRub: lotById.get(deal.lotId)?.priceRub ?? deal.dealAmountRub,
        counterpartyName: this.friendlyName(names.get(counterpartyId), counterpartyId),
        myRole,
        expiresAt: this.dealExpiresAt(deal, settings),
        createdAt: deal.createdAt,
      };
    });
  }

  private dealExpiresAt(
    deal: UzzDealDocument,
    settings:
      | { dealRequestTtlHours: number; dealFulfillmentDays: number }
      | undefined,
  ): Date | null {
    if (
      deal.status === 'closed' ||
      deal.status === 'rejected' ||
      deal.status === 'cancelled'
    ) {
      return null;
    }
    if (!settings) return null;
    if (deal.status === 'requested') {
      return new Date(
        deal.requestedAt.getTime() + settings.dealRequestTtlHours * 60 * 60 * 1000,
      );
    }
    const from = deal.acceptedAt?.getTime() ?? deal.requestedAt.getTime();
    return new Date(from + settings.dealFulfillmentDays * DAY_MS);
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

  private async walletScope(communityId: string): Promise<string> {
    const community = await this.communityService.getCommunity(communityId);
    return this.meritResolver.getWalletCommunityId(
      community ?? { id: communityId },
      'voting',
    );
  }

  private statusAfterBankReleased(
    bank: UzzBankDocument,
    settings: { nominalFloorRub: number },
  ): UzzBankStatus {
    if (bank.hopsLeft === 0) return 'exhausted';
    if (bank.nominalRub != null && bank.nominalRub <= settings.nominalFloorRub) {
      return 'exhausted';
    }
    return 'active';
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
