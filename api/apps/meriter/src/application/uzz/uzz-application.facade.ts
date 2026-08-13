import { UzzUnitOfWork } from './ports/uzz-unit-of-work';
import { UzzPlatformPort } from './ports/uzz-platform.port';
import { UzzAuthorizationService } from './uzz-authorization.service';
import { defaultSettings } from './uzz-settings';
import { EmitExchangeRightUseCase } from './use-cases/emit-exchange-right.use-case';
import { GetSettingsUseCase } from './use-cases/get-settings.use-case';
import { UpdateSettingsUseCase } from './use-cases/update-settings.use-case';
import { AssignRightNominalUseCase } from './use-cases/assign-right-nominal.use-case';
import { CreateListingUseCase } from './use-cases/create-listing.use-case';
import { UpdateListingUseCase } from './use-cases/update-listing.use-case';
import { ListCatalogUseCase } from './use-cases/list-catalog.use-case';
import { CheckPurchaseGateUseCase } from './use-cases/check-purchase-gate.use-case';
import { RequestDealUseCase } from './use-cases/request-deal.use-case';
import { AcceptDealUseCase } from './use-cases/accept-deal.use-case';
import { RejectDealUseCase } from './use-cases/reject-deal.use-case';
import { CancelDealUseCase } from './use-cases/cancel-deal.use-case';
import { MarkDealCompletedUseCase } from './use-cases/mark-deal-completed.use-case';
import { CloseDealUseCase } from './use-cases/close-deal.use-case';
import { AdminResolveDealUseCase } from './use-cases/admin-resolve-deal.use-case';
import { SendDealThanksUseCase } from './use-cases/send-deal-thanks.use-case';
import { StartTelegramLinkUseCase } from './use-cases/start-telegram-link.use-case';

export interface UzzFacadeCommands {
  getSettings: GetSettingsUseCase;
  updateSettings: UpdateSettingsUseCase;
  assignRightNominal: AssignRightNominalUseCase;
  createListing: CreateListingUseCase;
  updateListing: UpdateListingUseCase;
  listCatalog: ListCatalogUseCase;
  checkPurchaseGate: CheckPurchaseGateUseCase;
  requestDeal: RequestDealUseCase;
  acceptDeal: AcceptDealUseCase;
  rejectDeal: RejectDealUseCase;
  cancelDeal: CancelDealUseCase;
  markDealCompleted: MarkDealCompletedUseCase;
  closeDeal: CloseDealUseCase;
  adminResolveDeal: AdminResolveDealUseCase;
  sendDealThanks: SendDealThanksUseCase;
  startTelegramLink: StartTelegramLinkUseCase;
}

export class UzzApplicationFacade {
  constructor(
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly authorization: UzzAuthorizationService,
    private readonly platform: UzzPlatformPort,
    private readonly emitRight: EmitExchangeRightUseCase,
    private readonly globalCommunityId: string,
    private readonly commands: UzzFacadeCommands,
  ) {}

  getSettings(input: Parameters<GetSettingsUseCase['execute']>[0]) {
    return this.commands.getSettings.execute(input);
  }
  updateSettings(input: Parameters<UpdateSettingsUseCase['execute']>[0]) {
    return this.commands.updateSettings.execute(input);
  }
  assignRightNominal(input: Parameters<AssignRightNominalUseCase['execute']>[0]) {
    return this.commands.assignRightNominal.execute(input);
  }
  createListing(input: Parameters<CreateListingUseCase['execute']>[0]) {
    return this.commands.createListing.execute(input);
  }
  updateListing(input: Parameters<UpdateListingUseCase['execute']>[0]) {
    return this.commands.updateListing.execute(input);
  }
  listCatalog(input: Parameters<ListCatalogUseCase['execute']>[0]) {
    return this.commands.listCatalog.execute(input);
  }
  checkPurchaseGate(input: Parameters<CheckPurchaseGateUseCase['execute']>[0]) {
    return this.commands.checkPurchaseGate.execute(input);
  }
  requestDeal(input: Parameters<RequestDealUseCase['execute']>[0]) {
    return this.commands.requestDeal.execute(input);
  }
  acceptDeal(input: Parameters<AcceptDealUseCase['execute']>[0]) {
    return this.commands.acceptDeal.execute(input);
  }
  rejectDeal(input: Parameters<RejectDealUseCase['execute']>[0]) {
    return this.commands.rejectDeal.execute(input);
  }
  cancelDeal(input: Parameters<CancelDealUseCase['execute']>[0]) {
    return this.commands.cancelDeal.execute(input);
  }
  markDealCompleted(input: Parameters<MarkDealCompletedUseCase['execute']>[0]) {
    return this.commands.markDealCompleted.execute(input);
  }
  closeDeal(input: Parameters<CloseDealUseCase['execute']>[0]) {
    return this.commands.closeDeal.execute(input);
  }
  adminResolveDeal(input: Parameters<AdminResolveDealUseCase['execute']>[0]) {
    return this.commands.adminResolveDeal.execute(input);
  }
  sendDealThanks(input: Parameters<SendDealThanksUseCase['execute']>[0]) {
    return this.commands.sendDealThanks.execute(input);
  }
  startTelegramLink(input: Parameters<StartTelegramLinkUseCase['execute']>[0]) {
    return this.commands.startTelegramLink.execute(input);
  }

  async bootstrap(userId: string) {
    const communities = await this.platform.listUserCommunities(userId);
    const configured = this.platform.configuredCommunityId();
    const withTelegram = communities.filter((entry) => Boolean(entry.telegramChatId));
    const selected = withTelegram.length === 1
      ? withTelegram[0]
      : withTelegram.find((entry) => entry.id === configured)
        ?? communities.find((entry) => entry.id === configured)
        ?? (configured ? await this.platform.getCommunity(configured) : null);
    const communityId = selected?.id ?? configured;
    let isUzzAdmin = false;
    if (communityId) {
      try {
        await this.authorization.assertCommunityAdmin(communityId, userId);
        isUzzAdmin = true;
      } catch {
        isUzzAdmin = false;
      }
    }
    return {
      communityId,
      communityName: selected?.name ?? null,
      isUzzAdmin,
    };
  }

  async getLinkStatus(userId: string) {
    const ids = await this.authorization.resolveUserIds(userId);
    return this.unitOfWork.run(async (repositories) => {
      for (const id of ids) {
        const identity = await repositories.identities.findByCanonicalUserId(id);
        if (identity) {
          return {
            linked: Boolean(identity.normalizedEmail && identity.telegramUserId),
            telegramUserId: identity.telegramUserId,
            telegramUsername: identity.telegramUsername,
            email: identity.normalizedEmail,
          };
        }
      }
      return { linked: false, telegramUserId: null, telegramUsername: null, email: null };
    });
  }

  async listMyRights(userId: string, communityId: string) {
    await this.authorization.assertCommunityParticipant(communityId, userId);
    const userIds = await this.authorization.resolveUserIds(userId);
    const rights = await this.unitOfWork.run((repositories) =>
      repositories.rights.listByOwners(communityId, userIds),
    );
    return this.enrichRights(rights.map((right) => right.snapshot()));
  }

  async listRightsForAdmin(communityId: string, adminId: string, statuses: string[]) {
    await this.authorization.assertCommunityAdmin(communityId, adminId);
    const rights = await this.unitOfWork.run((repositories) =>
      repositories.rights.listByStatus(communityId, statuses),
    );
    return this.enrichRights(rights.map((right) => right.snapshot()));
  }

  async listDeals(communityId: string, userId: string) {
    await this.authorization.assertCommunityParticipant(communityId, userId);
    const userIds = await this.authorization.resolveUserIds(userId);
    const deals = await this.unitOfWork.run((repositories) =>
      repositories.deals.listByParticipants(communityId, userIds),
    );
    const snapshots = deals.map((deal) => deal.snapshot());
    const names = await this.platform.getDisplayNames(
      snapshots.flatMap((deal) => [deal.buyerId, deal.sellerId]),
    );
    return snapshots.map((deal) => {
      const isBuyer = userIds.includes(deal.buyerId);
      const isSeller = userIds.includes(deal.sellerId);
      const counterpartyId = isBuyer ? deal.sellerId : deal.buyerId;
      return {
        ...deal,
        myRole: isBuyer ? 'buyer' as const : isSeller ? 'seller' as const : 'other' as const,
        counterpartyName: displayName(names.get(counterpartyId)),
        expiresAt: deal.status === 'requested' ? deal.requestExpiresAt
          : deal.status === 'accepted' ? deal.fulfillmentExpiresAt
            : deal.status === 'completed_by_seller' ? deal.confirmationExpiresAt : null,
      };
    });
  }

  async listOpenDeals(communityId: string, adminId: string) {
    await this.authorization.assertCommunityAdmin(communityId, adminId);
    const deals = await this.unitOfWork.run((repositories) =>
      repositories.deals.listOpenByCommunity(communityId),
    );
    return deals.map((deal) => deal.snapshot());
  }

  async getFeeBalances(userId: string, communityId: string) {
    await this.authorization.assertCommunityParticipant(communityId, userId);
    return this.unitOfWork.run((repositories) => repositories.wallet.getBalances({
      userId, localCommunityId: communityId, globalCommunityId: this.globalCommunityId,
    }));
  }

  async listLedger(input: {
    communityId: string;
    viewerId: string;
    mineOnly: boolean;
    limit?: number;
    skip?: number;
  }) {
    if (input.mineOnly) {
      await this.authorization.assertCommunityParticipant(input.communityId, input.viewerId);
    } else {
      await this.authorization.assertCommunityAdmin(input.communityId, input.viewerId);
    }
    return this.unitOfWork.run((repositories) => repositories.ledger.list({
      communityId: input.communityId,
      userId: input.mineOnly ? input.viewerId : undefined,
      limit: Math.min(Math.max(input.limit ?? 50, 1), 100),
      skip: Math.max(input.skip ?? 0, 0),
    }));
  }

  async listDeeds(userId: string, communityId: string) {
    await this.authorization.assertCommunityParticipant(communityId, userId);
    const userIds = await this.authorization.resolveUserIds(userId);
    const [publications, settings, rights] = await Promise.all([
      this.platform.listDeedPublications(communityId, userIds),
      this.unitOfWork.run(async (repositories) =>
        await repositories.settings.findByCommunityId(communityId)
          ?? defaultSettings(communityId, new Date())),
      this.unitOfWork.run((repositories) => repositories.rights.listByOwners(communityId, userIds)),
    ]);
    const byPublication = new Map(rights.map((right) => [
      right.snapshot().sourcePublicationId, right.snapshot(),
    ]));
    return publications.map((publication) => ({
      publicationId: publication.id,
      title: publication.title,
      score: publication.score,
      emissionThreshold: settings.emissionThreshold,
      progress: Math.min(1, publication.score / Math.max(1, settings.emissionThreshold)),
      bankStatus: byPublication.get(publication.id)?.status,
    }));
  }

  maybeEmitRight(publicationId: string) {
    return this.emitRight.execute({ publicationId });
  }

  assertCanTriggerEmission(publicationId: string, userId: string) {
    return this.emitRight.assertCanTrigger(publicationId, userId, this.authorization);
  }

  private async enrichRights<T extends {
    ownerId: string;
    sourcePublicationId: string;
  }>(rights: T[]) {
    const names = await this.platform.getDisplayNames(rights.map((right) => right.ownerId));
    const publications = await Promise.all(
      rights.map((right) => this.platform.getPublication(right.sourcePublicationId)),
    );
    const byId = new Map(publications.filter(Boolean).map((publication) => [
      publication!.id, publication!,
    ]));
    return rights.map((right) => ({
      ...right,
      ownerName: displayName(names.get(right.ownerId)),
      sourceTitle: byId.get(right.sourcePublicationId)?.title,
      sourceScore: byId.get(right.sourcePublicationId)?.score,
    }));
  }
}

function displayName(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || 'Участник';
}
