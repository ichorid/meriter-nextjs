import { UzzUnitOfWork } from './ports/uzz-unit-of-work';
import { UzzPlatformPort, UzzUserLabel } from './ports/uzz-platform.port';
import {
  buildLedgerContext,
  collectLedgerRefs,
  LedgerDealInfo,
  resolveLedgerCounterpartyId,
} from './ledger-enrichment';
import { UzzAuthorizationService } from './uzz-authorization.service';
import { isIdentityReady } from './policies/uzz-access-policy';
import { resolveIdentityContext } from './use-cases/deal-use-case.helpers';
import { releaseHoldingRightsAfterIdentityReady, releaseReadyHoldingRightsInCommunity } from './use-cases/identity-link.helpers';
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
import { ListDeedsUseCase } from './use-cases/list-deeds.use-case';
import {
  ListPilotCommunitiesUseCase,
  SetPilotCommunityUseCase,
} from './use-cases/pilot-community.use-case';

export interface UzzFacadeCommands {
  getSettings: GetSettingsUseCase;
  updateSettings: UpdateSettingsUseCase;
  listPilotCommunities: ListPilotCommunitiesUseCase;
  setPilotCommunity: SetPilotCommunityUseCase;
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
  listDeeds: ListDeedsUseCase;
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
  getPublicCommunity(communityId: string) {
    return this.platform.getCommunity(communityId);
  }
  async getActiveCommunity() {
    const communityId = await this.platform.configuredCommunityId();
    if (!communityId) return null;
    return this.platform.getCommunity(communityId);
  }
  /** True when the community is the configured UZZ stand (pilot chat). */
  async isUzzCommunity(communityId: string): Promise<boolean> {
    if (!communityId) return false;
    const configured = await this.platform.configuredCommunityId();
    return Boolean(configured) && configured === communityId;
  }
  listPilotCommunities(adminId: string) {
    return this.commands.listPilotCommunities.execute(adminId);
  }
  setPilotCommunity(input: Parameters<SetPilotCommunityUseCase['execute']>[0]) {
    return this.commands.setPilotCommunity.execute(input);
  }

  async listCatalog(input: Parameters<ListCatalogUseCase['execute']>[0]) {
    const authorIds = input.authorId
      ? await this.authorization.resolveUserIds(input.authorId)
      : [undefined];
    const listings = (await Promise.all(authorIds.map((authorId) =>
      this.commands.listCatalog.execute({ ...input, authorId }),
    ))).flat();
    const uniqueListings = [...new Map(listings.map((listing) => [
      listing.id, listing,
    ])).values()];
    const labels = await this.platform.getUserLabels(
      uniqueListings.map((listing) => listing.authorId),
    );
    return uniqueListings.map((listing) => {
      const label = labels.get(listing.authorId);
      return {
        ...listing,
        ownerName: displayName(label?.name),
        ownerUsername: label?.username ?? null,
      };
    });
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
    const configured = await this.platform.configuredCommunityId();
    const selected = configured ? await this.platform.getCommunity(configured) : null;
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
    await this.catchUpReadyHoldingForUser(userId);
    return this.unitOfWork.run(async (repositories) => {
      const { identity } = await resolveIdentityContext(repositories, userId);
      if (!identity) {
        return { linked: false, telegramUserId: null, telegramUsername: null, email: null };
      }
      return {
        linked: isIdentityReady(identity),
        telegramUserId: identity.telegramUserId,
        telegramUsername: identity.telegramUsername,
        email: identity.normalizedEmail,
      };
    });
  }

  async listMyRights(userId: string, communityId: string) {
    await this.authorization.assertCommunityParticipant(communityId, userId);
    await this.catchUpReadyHoldingForUser(userId);
    const rights = await this.unitOfWork.run(async (repositories) => {
      const { userIds } = await resolveIdentityContext(repositories, userId);
      return repositories.rights.listByOwners(communityId, userIds);
    });
    return this.enrichRights(rights.map((right) => right.snapshot()));
  }

  async listRightsForAdmin(communityId: string, adminId: string, statuses: string[]) {
    await this.authorization.assertCommunityAdmin(communityId, adminId);
    if (statuses.includes('holding') || statuses.includes('awaiting_nominal')) {
      await this.catchUpReadyHoldingInCommunity(communityId);
    }
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
    const rights = await this.unitOfWork.run((repositories) =>
      Promise.all(snapshots.map((deal) => repositories.rights.findById(deal.exchangeRightId))),
    );
    const rightNominalById = new Map(rights.filter(Boolean).map((right) => [
      right!.snapshot().id,
      right!.snapshot().nominalRub,
    ]));
    const labels = await this.platform.getUserLabels(
      snapshots.flatMap((deal) => [deal.buyerId, deal.sellerId]),
    );
    return snapshots.map((deal) => {
      const isBuyer = userIds.includes(deal.buyerId);
      const isSeller = userIds.includes(deal.sellerId);
      const counterpartyId = isBuyer ? deal.sellerId : deal.buyerId;
      const counterparty = labels.get(counterpartyId);
      return {
        ...deal,
        myRole: isBuyer ? 'buyer' as const : isSeller ? 'seller' as const : 'other' as const,
        counterpartyName: displayName(counterparty?.name),
        counterpartyUsername: counterparty?.username ?? null,
        currentNominalRub: rightNominalById.get(deal.exchangeRightId) ?? null,
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
    const userIds = await this.authorization.resolveUserIds(userId);
    return this.unitOfWork.run(async (repositories) => {
      const balances = await Promise.all(userIds.map((resolvedUserId) =>
        repositories.wallet.getBalances({
          userId: resolvedUserId,
          localCommunityId: communityId,
          globalCommunityId: this.globalCommunityId,
        }),
      ));
      return balances.reduce((total, current) => ({
        localBalance: total.localBalance + current.localBalance,
        globalBalance: total.globalBalance + current.globalBalance,
        totalBalance: total.totalBalance + current.totalBalance,
        mode: current.mode,
      }), { localBalance: 0, globalBalance: 0, totalBalance: 0, mode: 'split' as const });
    });
  }

  async listLedger(input: {
    communityId: string;
    viewerId: string;
    mineOnly: boolean;
    limit?: number;
    cursor?: { createdAt: Date; id: string } | null;
  }) {
    if (input.mineOnly) {
      await this.authorization.assertCommunityParticipant(input.communityId, input.viewerId);
    } else {
      await this.authorization.assertCommunityAdmin(input.communityId, input.viewerId);
    }
    const userIds = input.mineOnly
      ? await this.authorization.resolveUserIds(input.viewerId)
      : undefined;
    const page = await this.unitOfWork.run(async (repositories) => {
      const result = await repositories.ledger.list({
        communityId: input.communityId,
        userIds,
        limit: Math.min(Math.max(input.limit ?? 30, 1), 50),
        cursor: input.cursor ?? null,
      });
      const { dealIds, publicationIds } = collectLedgerRefs(result.items);
      const deals = await Promise.all(
        dealIds.map((dealId) => repositories.deals.findById(dealId)),
      );
      const dealInfos = new Map<string, LedgerDealInfo>(
        deals.flatMap((deal) => {
          if (!deal) return [];
          const snapshot = deal.snapshot();
          return [[snapshot.id, {
            id: snapshot.id,
            buyerId: snapshot.buyerId,
            sellerId: snapshot.sellerId,
            listingTitle: snapshot.listingSnapshot.title,
          }] as const];
        }),
      );
      return { ...result, dealInfos, publicationIds };
    });
    // Display names and publication titles come from the platform, outside
    // the unit of work. Enrichment is best-effort: a failed lookup only
    // degrades the row to its bare form.
    const counterpartyIds = new Set<string>();
    for (const item of page.items) {
      const dealId = typeof item.metadata?.dealId === 'string' ? item.metadata.dealId : undefined;
      const counterpartyId = resolveLedgerCounterpartyId(
        item,
        dealId ? page.dealInfos.get(dealId) : undefined,
      );
      if (counterpartyId) counterpartyIds.add(counterpartyId);
    }
    let counterpartyLabels = new Map<string, UzzUserLabel>();
    const publicationTitles = new Map<string, string>();
    try {
      if (counterpartyIds.size > 0) {
        counterpartyLabels = await this.platform.getUserLabels([...counterpartyIds]);
      }
      const publications = await Promise.all(
        page.publicationIds.map((publicationId) => this.platform.getPublication(publicationId)),
      );
      for (const publication of publications) {
        if (publication) publicationTitles.set(publication.id, publication.title);
      }
    } catch {
      // Leave whatever was resolved so far.
    }
    return {
      items: page.items.map((item) => ({
        ...item,
        context: buildLedgerContext(item, page.dealInfos, counterpartyLabels, publicationTitles),
      })),
      nextCursor: page.nextCursor,
    };
  }

  listDeeds(userId: string, communityId: string) {
    return this.commands.listDeeds.execute({ userId, communityId });
  }

  maybeEmitRight(publicationId: string) {
    return this.emitRight.execute({ publicationId });
  }

  assertCanTriggerEmission(publicationId: string, userId: string) {
    return this.emitRight.assertCanTrigger(publicationId, userId, this.authorization);
  }

  private async catchUpReadyHoldingForUser(userId: string): Promise<void> {
    try {
      await this.unitOfWork.run(async (repositories) => {
        const { identity, userIds } = await resolveIdentityContext(repositories, userId);
        if (!isIdentityReady(identity)) return;
        await releaseHoldingRightsAfterIdentityReady(repositories, userIds, new Date());
      });
    } catch (error) {
      if (!isIgnorableCatchUpConflict(error)) throw error;
    }
  }

  private async catchUpReadyHoldingInCommunity(communityId: string): Promise<void> {
    try {
      await this.unitOfWork.run(async (repositories) => {
        await releaseReadyHoldingRightsInCommunity(repositories, communityId, new Date());
      });
    } catch (error) {
      if (!isIgnorableCatchUpConflict(error)) throw error;
    }
  }

  private async enrichRights<T extends {
    ownerId: string;
    sourcePublicationId: string;
  }>(rights: T[]) {
    const labels = await this.platform.getUserLabels(rights.map((right) => right.ownerId));
    const publications = await Promise.all(
      rights.map((right) => this.platform.getPublication(right.sourcePublicationId)),
    );
    const byId = new Map(publications.filter(Boolean).map((publication) => [
      publication!.id, publication!,
    ]));
    return rights.map((right) => ({
      ...right,
      ownerName: displayName(labels.get(right.ownerId)?.name),
      ownerUsername: labels.get(right.ownerId)?.username ?? null,
      sourceTitle: byId.get(right.sourcePublicationId)?.title,
      sourceScore: byId.get(right.sourcePublicationId)?.score,
    }));
  }
}

function displayName(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || 'Участник';
}

function isIgnorableCatchUpConflict(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      typeof (error as { code?: unknown }).code === 'string' &&
      ((error as { code: string }).code === 'UZZ_CONCURRENT_MODIFICATION' ||
        (error as { code: string }).code.endsWith('_CONFLICT') ||
        (error as { name?: unknown }).name === 'UzzConflictError'),
  );
}
