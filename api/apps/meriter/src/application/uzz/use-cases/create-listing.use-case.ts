import { randomUUID } from 'crypto';
import {
  CreateListingInput,
  Listing,
  ListingSnapshot,
} from '../../../domain/uzz/entities/listing';
import { UzzAccessPolicy } from '../policies/uzz-access-policy';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';

export type CreateListingCommand = Omit<CreateListingInput, 'id'>;

export class CreateListingUseCase {
  constructor(
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly accessPolicy: UzzAccessPolicy,
  ) {}

  async execute(command: CreateListingCommand): Promise<ListingSnapshot> {
    return this.unitOfWork.run(async (repositories) => {
      const identity = await repositories.identities.findByCanonicalUserId(
        command.authorId,
      );
      const aliases = identity
        ? await repositories.identities.listAliases(identity.id)
        : [];
      await this.accessPolicy.assertMember(command.communityId, [
        command.authorId,
        ...aliases.map((alias) => alias.aliasUserId),
      ]);
      this.accessPolicy.assertIdentityReady(identity);

      const listing = Listing.create({
        ...command,
        id: randomUUID(),
      });
      await repositories.listings.insert(listing);
      return listing.snapshot();
    });
  }
}
