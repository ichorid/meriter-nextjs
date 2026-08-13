import { UzzAccessPolicy } from '../policies/uzz-access-policy';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';

const DEFAULT_MINIMUM_LISTINGS = 3;

export class CheckPurchaseGateUseCase {
  constructor(
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly accessPolicy: UzzAccessPolicy,
  ) {}

  async execute(input: { communityId: string; buyerId: string }) {
    return this.unitOfWork.run(async (repositories) => {
      const identity = await repositories.identities.findByCanonicalUserId(
        input.buyerId,
      );
      const aliases = identity
        ? await repositories.identities.listAliases(identity.id)
        : [];
      await this.accessPolicy.assertMember(input.communityId, [
        input.buyerId,
        ...aliases.map((alias) => alias.aliasUserId),
      ]);
      this.accessPolicy.assertIdentityReady(identity);
      const userIds = [
        input.buyerId,
        ...aliases.map((alias) => alias.aliasUserId),
      ];
      const [settings, listingCounts] = await Promise.all([
        repositories.settings.findByCommunityId(input.communityId),
        Promise.all(userIds.map((authorId) =>
          repositories.listings.countActiveByAuthor(input.communityId, authorId),
        )),
      ]);
      const activeListingCount = listingCounts.reduce((sum, count) => sum + count, 0);
      const minimumListings =
        settings?.minimumListingsToBuy ?? DEFAULT_MINIMUM_LISTINGS;
      const decision = this.accessPolicy.evaluatePurchase({
        mode: settings?.purchaseGateMode ?? 'nudge',
        activeListingCount,
        minimum: minimumListings,
      });
      return {
        ...decision,
        activeListingCount,
        minimumListings,
      };
    });
  }
}
