import {
  ListingSnapshot,
} from '../../../domain/uzz/entities/listing';
import { UzzNotFoundError } from '../../../domain/uzz/errors';
import { UzzAccessPolicy } from '../policies/uzz-access-policy';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { CommandExecutor } from './command-executor';

export type UpdateListingCommand = {
  commandId: string;
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
  private readonly commands: CommandExecutor;

  constructor(
    unitOfWork: UzzUnitOfWork,
    private readonly accessPolicy: UzzAccessPolicy,
  ) {
    this.commands = new CommandExecutor(unitOfWork);
  }

  async execute(command: UpdateListingCommand): Promise<ListingSnapshot> {
    const { commandId, now, ...payload } = command;
    return this.commands.execute({
      commandId,
      actorId: command.actorId,
      type: 'update_listing',
      payload,
      work: async (repositories) => {
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

        const {
          listingId: _listingId,
          actorId: _actorId,
          commandId: _commandId,
          now: _now,
          ...patch
        } = command;
        listing.update(patch, now ?? new Date());
        await repositories.listings.update(listing);
        return listing.snapshot();
      },
    });
  }
}
