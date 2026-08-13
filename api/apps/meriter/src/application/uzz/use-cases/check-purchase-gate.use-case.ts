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
      const [settings, activeListingCount] = await Promise.all([
        repositories.settings.findByCommunityId(input.communityId),
        repositories.listings.countActiveByAuthor(
          input.communityId,
          input.buyerId,
        ),
      ]);
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
