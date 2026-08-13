import {
  ListingSnapshot,
} from '../../../domain/uzz/entities/listing';
import { UzzNotFoundError } from '../../../domain/uzz/errors';
import { UzzAccessPolicy } from '../policies/uzz-access-policy';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';

export type UpdateListingCommand = {
  listingId: string;
  actorId: string;
  now?: Date;
} & Partial<
  Pick<
    ListingSnapshot,
    | 'title'
    | 'description'
    | 'priceRub'
    | 'deliveryMode'
    | 'locationText'
    | 'durationText'
    | 'availabilityText'
    | 'active'
  >
>;

export class UpdateListingUseCase {
  constructor(
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly accessPolicy: UzzAccessPolicy,
  ) {}

  async execute(command: UpdateListingCommand): Promise<ListingSnapshot> {
    return this.unitOfWork.run(async (repositories) => {
      const listing = await repositories.listings.findById(command.listingId);
      if (!listing) {
        throw new UzzNotFoundError('LISTING_NOT_FOUND');
      }
      const current = listing.snapshot();
      const identity = await repositories.identities.findByCanonicalUserId(
        command.actorId,
      );
      const aliases = identity
        ? await repositories.identities.listAliases(identity.id)
        : [];
      await this.accessPolicy.assertMember(current.communityId, [
        command.actorId,
        ...aliases.map((alias) => alias.aliasUserId),
      ]);
      this.accessPolicy.assertListingAuthor(current.authorId, command.actorId);
      this.accessPolicy.assertIdentityReady(identity);

      const { listingId: _listingId, actorId: _actorId, now, ...patch } = command;
      listing.update(patch, now ?? new Date());
      await repositories.listings.update(listing);
      return listing.snapshot();
    });
  }
}
