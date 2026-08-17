import { randomUUID } from 'crypto';
import {
  CreateListingInput,
  Listing,
  ListingSnapshot,
} from '../../../domain/uzz/entities/listing';
import { UzzAccessPolicy } from '../policies/uzz-access-policy';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { CommandExecutor } from './command-executor';
import { assertReadyMember } from './deal-use-case.helpers';

export type CreateListingCommand = Omit<CreateListingInput, 'id'> & {
  commandId: string;
};

export class CreateListingUseCase {
  private readonly commands: CommandExecutor;

  constructor(
    unitOfWork: UzzUnitOfWork,
    private readonly accessPolicy: UzzAccessPolicy,
  ) {
    this.commands = new CommandExecutor(unitOfWork);
  }

  async execute(command: CreateListingCommand): Promise<ListingSnapshot> {
    const { commandId, now: _now, ...payload } = command;
    return this.commands.execute({
      commandId,
      actorId: command.authorId,
      type: 'create_listing',
      payload,
      work: async (repositories) => {
        await assertReadyMember(
          repositories,
          this.accessPolicy,
          command.communityId,
          command.authorId,
        );

        const listing = Listing.create({
          ...payload,
          now: command.now,
          id: randomUUID(),
        });
        await repositories.listings.insert(listing);
        return listing.snapshot();
      },
    });
  }
}
